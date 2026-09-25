"""
Write the AI insights each demo shows beside its sections.

Meridian's analyst's notes, Kestrel's dispatch recommendations, Sable & Finch's committee
recommendations and draft resolutions, and Lumen's decision support are all one file per
project, dashboard/data/insights.json, written here after every refresh and read by shell.js.

    .venv/Scripts/python.exe scripts/ai_insights.py                    every project
    .venv/Scripts/python.exe scripts/ai_insights.py --project 02-kestrel-logistics
    .venv/Scripts/python.exe scripts/ai_insights.py --dry-run          print the context, call nothing

Grounding. The model sees exactly what the page reads: the gold marts exported to Parquet, the
summary export_parquet.py writes into meta.json, and the column definitions in
_gold__models.yml. It never sees ANSWER_KEY.md. That file is the reveal script, and an analyst
that had read the answers would not be discovering anything.

Providers, in the order they are tried when AI_PROVIDER is not set:

    anthropic   ANTHROPIC_API_KEY    Claude, through the official anthropic SDK
    gemini      GEMINI_API_KEY       Google AI Studio, free tier
    groq        GROQ_API_KEY         Groq, free tier
    openrouter  OPENROUTER_API_KEY   OpenRouter, a free model
    github      GITHUB_TOKEN         GitHub Models, free with the token every Actions job gets

So the nightly job writes insights with no secret configured at all, through GitHub Models,
and moves to Claude the day an ANTHROPIC_API_KEY secret is added. AI_MODEL overrides the
default model for whichever provider is chosen.

Checks before anything is written. Every section must be present. Dashes the house style
forbids are rewritten. A rand value the model attaches to a section has to match a figure that
is actually in the data it was given, within 2%, or it is dropped rather than published. If a
provider fails or returns something unusable, the last good file stays where it is and the job
carries on: a missing insight is better than an invented one.

The free providers are called with the standard library alone. Only the Claude path needs a
package, and it is installed in CI beside dbt.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROJECTS_DIR = ROOT / "projects"

# Built with chr() rather than written out, like no_em_dashes.py, so this file never contains
# the characters it removes and the house style check stays clean.
EM = chr(0x2014)
EN = chr(0x2013)
EM_ESC = "\\" + "u2014"
EN_ESC = "\\" + "u2013"

# ---------------------------------------------------------------- what each demo is about

PROJECTS: dict[str, dict] = {
    "01-meridian-provisions": {
        "client": "Meridian Provisions Co.",
        "business": "a Gauteng based FMCG distributor selling to Modern Trade, General Trade, "
                    "Wholesale and HoReCa customers from three distribution centres",
        "reader": "the CFO and the Commercial Director",
        "sections": {
            "gap": "The gap: revenue grew, gross profit did not keep up",
            "water": "The range sold at a loss (Cascade Springs bottled water, after freight and rebates)",
            "promo": "The promotion that loses money (Brightwash Powder 2kg, Buy 2 Get 1 Free)",
            "discount": "The discount nobody reset (Summit Cash & Carry)",
            "stock": "Sales that never happened (weekend stock-outs at the Gauteng DC)",
            "dead": "Stock nobody is buying (discontinued Halo Shine aerosols)",
        },
        "rules": "Twelve month figures and two year figures must never be mixed; say which "
                 "window a figure covers. Dead stock is working capital, not profit.",
        "dump": ["mart_gp_bridge"],
        "queries": [
            ("Brand contribution, last twelve months",
             "select brand, any_value(revenue_zar) as revenue_zar, any_value(gross_profit_zar) as gross_profit_zar, "
             "any_value(allocated_freight_zar) as freight_zar, any_value(allocated_rebate_zar) as rebate_zar, "
             "any_value(contribution_zar) as contribution_zar, any_value(brand_gross_margin_pct) as gm_pct, "
             "any_value(brand_contribution_margin_pct) as cm_pct, any_value(is_margin_trap) as is_margin_trap "
             "from mart_margin_waterfall where period_order = 1 group by brand order by contribution_zar"),
            ("Cascade Springs, gross profit to contribution, last twelve months",
             "select step_order, step_label, step_value_zar, running_total_zar from mart_margin_waterfall "
             "where brand = 'Cascade Springs' and period_order = 1 order by step_order"),
            ("Brightwash Powder 2kg by promotion phase, full window",
             "select promo_phase, sum(units) as units, sum(gross_profit_zar) as gross_profit_zar, "
             "sum(gross_profit_zar) / nullif(sum(units), 0) as gp_per_unit_zar, "
             "avg(volume_index_vs_baseline_pct) as volume_vs_baseline_pct "
             "from mart_promo_performance where product_name like 'Brightwash Powder 2kg%' group by 1"),
            ("Summit Cash & Carry realised discount by month, against the rest of Wholesale",
             "select year_month, realised_discount_pct, channel_excl_group_realised_discount_pct as rest_of_wholesale_pct, "
             "revenue_forgone_vs_baseline_zar from mart_discount_trend "
             "where customer_group = 'Summit Cash & Carry' order by month_start_date"),
            ("Weekend stock-outs by warehouse and product, full window",
             "select warehouse_code, product_name, count(*) as weeks, sum(lost_units_est) as units, "
             "sum(lost_revenue_zar) as revenue_zar, sum(lost_gross_profit_zar) as gross_profit_zar, "
             "max(stockout_week_pct) as worst_share_of_weeks_pct from mart_stockout_impact "
             "group by 1, 2 order by revenue_zar desc"),
            ("Dead stock by warehouse and product",
             "select warehouse_name, product_name, sum(units_on_hand) as units, sum(dead_stock_value_zar) as value_zar, "
             "min(days_since_last_sale) as days_since_last_sale from mart_dead_stock where is_dead_stock "
             "group by 1, 2 order by value_zar desc"),
            ("Company trading by month",
             "select year_month, sum(revenue_zar) as revenue_zar, sum(gross_profit_zar) as gross_profit_zar, "
             "sum(gross_profit_zar) / nullif(sum(revenue_zar), 0) * 100 as margin_pct "
             "from agg_sales_monthly group by year_month order by year_month"),
        ],
    },
    "02-kestrel-logistics": {
        "client": "Kestrel Logistics",
        "business": "a South African road freight operator running line-haul and distribution "
                    "from hubs in Gauteng, KwaZulu-Natal and the Western Cape",
        "reader": "the COO",
        "sections": {
            "network": "The network: empty running and round trip contribution",
            "corridors": "Corridors that fund their own empty return",
            "doors": "Deliveries that had to be done twice",
            "thirsty": "Vehicles burning more diesel than their class",
            "friday": "Friday and month end dispatch, and the service penalties",
            "air": "Paying to move air: trips full by volume and light by weight",
            "close": "What it is worth: the opportunity bridge",
        },
        "rules": "Paying to move air is not money on the table today; it is the case for "
                 "consolidation. Never promise full recovery of the bridge.",
        "dump": ["mart_opportunity_bridge"],
        "queries": [
            ("Line-haul and distribution lanes, last twelve months",
             "select lane_name, lane_type, origin_depot_name, round_trips, revenue_zar, contribution_zar, "
             "outbound_only_contribution_zar, actual_backhaul_pct, assumed_backhaul_pct, "
             "contribution_margin_pct, is_backhaul_trap from mart_lane_economics where period_order = 1 "
             "order by contribution_zar"),
            ("Empty running, last twelve months",
             "select sum(empty_distance_km) as empty_km, sum(distance_km) as km, "
             "sum(empty_distance_km) * 100.0 / nullif(sum(distance_km), 0) as empty_pct "
             "from agg_trip_monthly where is_trailing_twelve_months"),
            ("Failed first attempt deliveries, last twelve months, all sites",
             "select sum(drops) as drops, sum(failed_drops) as failed, sum(failed_cost_zar) as failed_cost_zar "
             "from mart_failed_deliveries where is_trailing_twelve_months"),
            ("Failed deliveries by site, worst fifteen, last twelve months",
             "select customer_name, contract_type, sum(drops) as drops, sum(failed_drops) as failed, "
             "round(sum(failed_drops) * 100.0 / nullif(sum(drops), 0), 1) as failure_rate_pct, "
             "round(sum(failed_cost_zar), 2) as failed_cost_zar, any_value(top_failure_reason) as usual_reason "
             "from mart_failed_deliveries where is_trailing_twelve_months group by 1, 2 "
             "order by failed_cost_zar desc limit 15"),
            ("Fuel outliers against their class median",
             "select registration, vehicle_class, depot_name, litres_per_100km, class_median_l100, excess_pct, "
             "excess_cost_zar from mart_fuel_outliers where is_outlier order by excess_cost_zar desc"),
            ("On time delivery by dispatch day and contract, last twelve months",
             "select dispatch_day_bucket, contract_type, sum(drops) as drops, "
             "round(sum(on_time_drops) * 100.0 / nullif(sum(drops), 0), 1) as on_time_pct, "
             "round(sum(penalty_exposure_zar), 2) as penalty_exposure_zar from mart_sla_performance "
             "where is_trailing_twelve_months group by 1, 2 order by 1, 2"),
            ("Trips full of air by vehicle class",
             "select vehicle_class, sum(air_trips) as air_trips, sum(trips) as trips, "
             "round(avg(avg_weight_utilisation_pct), 1) as weight_used_pct, "
             "round(avg(avg_volume_utilisation_pct), 1) as volume_used_pct, "
             "round(sum(air_trip_cost_zar), 2) as running_cost_zar from mart_load_factor group by 1 "
             "order by running_cost_zar desc"),
        ],
    },
    "03-sable-finch-credit": {
        "client": "Sable & Finch Credit",
        "business": "a South African unsecured microlender with nine branches, regulated under "
                    "the National Credit Act",
        "reader": "the Chief Risk Officer and the credit committee",
        "sections": {
            "book": "The book: vintage curves against portfolio at risk",
            "branch": "One branch stopped writing the same business",
            "afford": "Loans written with nothing left over (affordability)",
            "topups": "Arrears refinanced rather than collected (top-ups)",
            "debit": "Debit orders presented on the wrong day",
            "collections": "Collections effort against where it works",
            "close": "What it adds up to: the exposure bridge",
        },
        "rules": "The outstanding balance on agreements written below the affordability floor is "
                 "an exposure at legal risk (reckless credit), not an expected loss. It is reported "
                 "beside the loss bridge and never added to it. Conduct findings are stated as "
                 "matters for review, never as accusations against a named person.",
        "dump": ["mart_exposure_bridge", "mart_debit_order", "mart_collections"],
        "queries": [
            ("Book by month",
             "select year_month, gross_book_zar, par30_pct, par90_pct, loans_disbursed, disbursed_zar "
             "from agg_book_monthly order by month_start_date"),
            ("Bad rate at month six by disbursement cohort, whole book",
             "select cohort_label, round(sum(bad_principal_zar) / nullif(sum(cohort_principal_zar), 0) * 100, 2) "
             "as bad_rate_at_month_6_pct, sum(cohort_loans) as loans from mart_vintage where months_on_book = 6 "
             "group by 1 order by 1"),
            ("Branch risk for loans written since May 2025",
             "select branch_name, province, sum(loans) as loans, "
             "round(sum(principal_ever_90) / nullif(sum(principal_zar), 0) * 100, 2) as bad_rate_pct, "
             "round(avg(bad_rate_vs_book_x), 2) as vs_book_x, "
             "round(sum(loans_income_inflated) * 100.0 / nullif(sum(loans), 0), 1) as income_inflated_pct, "
             "round(sum(net_loss_zar), 2) as net_loss_zar from mart_branch_risk "
             "where cohort_month >= date '2025-05-01' group by 1, 2 order by vs_book_x desc"),
            ("Affordability bands",
             "select affordability_band, sum(loans) as loans, round(sum(principal_zar), 2) as principal_zar, "
             "round(sum(outstanding_zar), 2) as outstanding_zar, "
             "round(sum(principal_ever_90) / nullif(sum(principal_zar), 0) * 100, 2) as bad_rate_pct, "
             "round(sum(net_loss_zar), 2) as net_loss_zar from mart_affordability group by 1"),
            ("Top-ups",
             "select count(*) as topups, count(*) filter (where settled_account_was_delinquent) as settled_delinquent, "
             "round(avg(instalment_increase_zar), 2) as avg_instalment_increase_zar, "
             "round(avg(principal_multiple), 2) as avg_principal_multiple, "
             "round(count(*) filter (where topup_ever_90) * 100.0 / count(*), 2) as topup_bad_pct, "
             "round(sum(topup_net_loss_zar), 2) as topup_net_loss_zar from mart_topup_masking"),
        ],
    },
    "04-lumen-health": {
        "client": "Lumen Health Network",
        "business": "a South African private primary care group with six clinics and 32 "
                    "practitioners, billing medical schemes and patients",
        "reader": "the Group MD, the Finance Director and the practice managers",
        "sections": {
            "money": "The money: billed for care delivered against cash received",
            "week": "The week is lopsided and the roster is not (slot fill and waiting time)",
            "claims": "Rejected claims that nobody worked",
            "noshow": "Patients who never arrived, and reminders",
            "reception": "The gap at reception, and the scheme that pays late",
            "diaries": "The same session rate buying very different diaries (practitioners)",
            "trend": "Trend and data quality",
        },
        "rules": "Three quantities must never be added together: revenue billed and never "
                 "collected, clinician cost of empty capacity, and working capital tied up by "
                 "late schemes. Late scheme money is not lost, it arrives late. The advice is "
                 "operational, never clinical.",
        "dump": ["mart_collection_bridge", "mart_capacity_cost", "mart_no_show", "mart_claim_recovery",
                 "mart_patient_charges", "mart_scheme", "mart_practitioner", "mart_clinic",
                 "mart_data_quality", "agg_monthly"],
        "queries": [
            ("Slot fill and waiting time by weekday and hour",
             "select * from mart_slot_grid order by day_of_week, slot_hour"),
        ],
    },
}

# ---------------------------------------------------------------- providers

OPENAI_COMPATIBLE = {
    # name: (key variable, endpoint, default model, label, compact context)
    "gemini": ("GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
               "gemini-2.5-flash", "Google Gemini", False),
    "groq": ("GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions",
             "llama-3.3-70b-versatile", "Groq", True),
    "openrouter": ("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/chat/completions",
                   "meta-llama/llama-3.3-70b-instruct:free", "OpenRouter", True),
    # GitHub Models caps a free request at about 8,000 input tokens, hence the compact context.
    "github": ("GITHUB_TOKEN", "https://models.github.ai/inference/chat/completions",
               "openai/gpt-4.1-mini", "GitHub Models", True),
}
ORDER = ["anthropic", "gemini", "groq", "openrouter", "github"]
ANTHROPIC_DEFAULT_MODEL = "claude-opus-5"


def choose_provider() -> str | None:
    wanted = (os.environ.get("AI_PROVIDER") or "").strip().lower()
    if wanted:
        return wanted
    for name in ORDER:
        key = "ANTHROPIC_API_KEY" if name == "anthropic" else OPENAI_COMPATIBLE[name][0]
        if os.environ.get(key):
            return name
    return None


def call_anthropic(system: str, user: str, schema: dict, model: str) -> tuple[dict, str]:
    import anthropic  # the official SDK; only this path needs it

    client = anthropic.Anthropic()
    # Server side fallback: if the chosen model declines, the same request is re-run on the
    # fallback model inside the same call, so a nightly job does not simply stop.
    response = client.beta.messages.create(
        model=model,
        max_tokens=16000,
        betas=["server-side-fallback-2026-06-01"],
        fallbacks=[{"model": "claude-opus-4-8"}],
        thinking={"type": "adaptive"},
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"format": {"type": "json_schema", "schema": schema}},
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("the model declined the request")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("the response was cut off at max_tokens")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text), response.model


def call_openai_compatible(name: str, system: str, user: str, schema: dict, model: str) -> tuple[dict, str]:
    key_var, url, _, _, _ = OPENAI_COMPATIBLE[name]
    key = os.environ.get(key_var)
    if not key:
        raise RuntimeError(f"{key_var} is not set")
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user + "\n\nReturn one JSON object matching this JSON Schema "
                                                 "exactly, and nothing else:\n" + json.dumps(schema)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{name} returned HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:400]}") from e
    text = payload["choices"][0]["message"]["content"]
    # Some models wrap JSON in a code fence even when asked not to.
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(text), payload.get("model") or model


def model_label(model: str) -> str:
    """claude-opus-5 -> Claude Opus 5, openai/gpt-4.1-mini -> GPT-4.1 mini, and so on."""
    m = model.split("/")[-1].split(":")[0]
    if m.startswith("claude-"):
        parts = m.split("-")[1:]
        words = [p.capitalize() for p in parts if not p.isdigit()]
        nums = ".".join(p for p in parts if p.isdigit())
        return "Claude " + " ".join(words) + (f" {nums}" if nums else "")
    if m.startswith("gpt-"):
        return "GPT-" + m[4:].replace("-", " ")
    if m.startswith("gemini-"):
        return "Gemini " + m[7:].replace("-", " ").title()
    return m


# ---------------------------------------------------------------- context


def fmt_cell(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:.2f}"
    return str(v).replace(",", " ").replace("\n", " ")


def run_queries(project: str, spec: dict, max_rows: int) -> tuple[list[str], list[float]]:
    """The tables and queries the page reads, as small CSV blocks. Returns the numbers too."""
    try:
        import duckdb
    except ImportError:
        print("  duckdb is not installed, the context will carry meta.json only", file=sys.stderr)
        return [], []
    data = PROJECTS_DIR / project / "dashboard" / "data"
    con = duckdb.connect()
    for p in sorted(data.glob("*.parquet")):
        con.execute(f"create view {p.stem} as select * from read_parquet('{p.as_posix()}')")

    blocks, numbers = [], []
    items = [(f"Table {t}", f"select * from {t}") for t in spec.get("dump", [])] + spec["queries"]
    for label, sql in items:
        try:
            cur = con.execute(sql)
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
        except Exception as e:  # a query that no longer matches the mart is skipped, not fatal
            print(f"  skipped {label}: {e}", file=sys.stderr)
            continue
        shown = rows[:max_rows]
        for r in rows:
            numbers.extend(float(x) for x in r if isinstance(x, (int, float)) and not isinstance(x, bool))
        lines = [",".join(cols)] + [",".join(fmt_cell(x) for x in r) for r in shown]
        more = f"\n({len(rows) - len(shown)} more rows not shown)" if len(rows) > len(shown) else ""
        blocks.append(f"### {label}\n" + "\n".join(lines) + more)
    return blocks, numbers


def summary_text(meta: dict) -> tuple[str, list[float]]:
    s = meta.get("summary") or {}
    numbers = []
    lines = []
    hero = s.get("hero") or {}
    if hero:
        numbers.append(float(hero.get("v") or 0))
        lines.append(f"Headline: {hero.get('v')} ({hero.get('f')}) {hero.get('label', '')}")
    for f in s.get("findings", []):
        numbers.append(float(f.get("v") or 0))
        lines.append(f"Finding {f.get('n')} [{f.get('id')}] {f.get('title')}: {f.get('v')} ({f.get('f')}) {f.get('note', '')}")
    return "\n".join(lines), numbers


def build_context(project: str, compact: bool) -> tuple[str, list[float], dict]:
    spec = PROJECTS[project]
    meta = json.loads((PROJECTS_DIR / project / "dashboard" / "data" / "meta.json").read_text(encoding="utf-8"))
    summ, numbers = summary_text(meta)
    blocks, qnums = run_queries(project, spec, max_rows=20 if compact else 60)
    numbers += qnums
    if compact and blocks:
        # The free tiers cap a request at about 8,000 input tokens. Share roughly 14,000
        # characters of data evenly between the blocks, cutting each at a row boundary. The
        # grounding figures above still come from every row, so a value the model quotes from
        # the page's own summary is not rejected just because its row was trimmed here.
        per = 14000 // len(blocks)
        trimmed = []
        for b in blocks:
            if len(b) > per:
                b = b[:per].rsplit("\n", 1)[0] + "\n(more rows not shown)"
            trimmed.append(b)
        blocks = trimmed
    for k in ("orders", "trips", "kilometres", "loans", "disbursed_zar", "appointments", "billed_zar"):
        if isinstance(meta.get(k), (int, float)):
            numbers.append(float(meta[k]))

    parts = [
        f"Data covers {meta.get('data_from')} to {meta.get('data_through')}. All money is South "
        f"African rand, excluding VAT. The data is synthetic demonstration data.",
        "## The page's own summary, computed from the gold layer\n" + summ,
        "## Data the page reads\n" + "\n\n".join(blocks),
    ]
    if not compact:
        docs = PROJECTS_DIR / project / "dbt" / "models" / "gold" / "_gold__models.yml"
        if docs.exists():
            parts.append("## What each gold column means\n" + docs.read_text(encoding="utf-8")[:20000])
    return "\n\n".join(parts), numbers, meta


def schema_for(project: str) -> dict:
    sections = list(PROJECTS[project]["sections"])
    nullable_number = {"anyOf": [{"type": "number"}, {"type": "null"}]}
    action = {
        "type": "object",
        "properties": {"do": {"type": "string"}, "owner": {"type": "string"}, "when": {"type": "string"}},
        "required": ["do", "owner", "when"],
        "additionalProperties": False,
    }
    section = {
        "type": "object",
        "properties": {
            "insight": {"type": "string"},
            "why": {"type": "string"},
            "actions": {"type": "array", "items": action},
            "value_zar": nullable_number,
            "value_note": {"type": "string"},
            "confidence": {"type": "string", "enum": ["High", "Medium", "Low"]},
        },
        "required": ["insight", "why", "actions", "value_zar", "value_note", "confidence"],
        "additionalProperties": False,
    }
    priority = {
        "type": "object",
        "properties": {
            "section": {"type": "string", "enum": sections},
            "action": {"type": "string"},
            "owner": {"type": "string"},
            "horizon": {"type": "string"},
            "value_zar": nullable_number,
        },
        "required": ["section", "action", "owner", "horizon", "value_zar"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "overview": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string"},
                    "summary": {"type": "string"},
                    "priorities": {"type": "array", "items": priority},
                },
                "required": ["headline", "summary", "priorities"],
                "additionalProperties": False,
            },
            "sections": {
                "type": "object",
                "properties": {sid: section for sid in sections},
                "required": sections,
                "additionalProperties": False,
            },
        },
        "required": ["overview", "sections"],
        "additionalProperties": False,
    }


def prompts(project: str, context: str) -> tuple[str, str]:
    spec = PROJECTS[project]
    sections = "\n".join(f"- {sid}: {title}" for sid, title in spec["sections"].items())
    system = (
        f"You are the Omnatix AI analyst. You write the insights and recommendations that sit beside "
        f"each section of a decision dashboard for {spec['client']}, {spec['business']}. Your reader "
        f"is {spec['reader']}: busy, numerate, and sceptical of anything they cannot check.\n\n"
        "Rules:\n"
        "- Use only figures that appear in the data you are given. Never estimate, extrapolate or invent a number.\n"
        "- Money is South African rand excluding VAT. Write it as R3.9m, R401k or R2,052.\n"
        "- Never add together figures of different kinds, such as revenue forgone, cost incurred, "
        "balances at legal risk and working capital. Say which window a figure covers when it matters.\n"
        f"- {spec['rules']}\n"
        "- insight: what the data shows, one or two sentences, at most 35 words.\n"
        "- why: why it happens and why nobody saw it, at most 60 words.\n"
        "- actions: two or three concrete actions, each at most 20 words, owned by a role (never a "
        "named person) with a time frame such as This week, 30 days or Next rate review.\n"
        "- value_zar: the rand figure from the data that this finding is worth, or null if there is none. "
        "value_note says in a few words what that figure is and over what window.\n"
        "- confidence: High when the data states it directly, Medium when it depends on an estimate "
        "or allocation, Low otherwise.\n"
        "- overview: a headline of at most 30 words, a summary of at most 90 words, and four or five "
        "priorities in the order to act on them, each naming the section it comes from.\n"
        "- Plain English, short sentences. No em dashes, no en dashes, no emojis, no exclamation marks.\n"
        "- Recommendations are operational and commercial. Never give clinical, legal or investment advice; "
        "say a matter needs review instead."
    )
    user = (
        f"Sections of the dashboard, by id:\n{sections}\n\n{context}\n\n"
        "Write the overview and one entry for every section id listed above."
    )
    return system, user


# ---------------------------------------------------------------- checks


def tidy(s) -> str:
    s = str(s or "").strip()
    s = re.sub(r"\s*" + EM + r"\s*", ", ", s)
    s = s.replace(EN, "-").replace(EM_ESC, ", ").replace(EN_ESC, "-")
    return re.sub(r"\s{2,}", " ", s)


def grounded(v, numbers: list[float]):
    """A value survives only if the data it was written from contains it, within 2%."""
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return None
    tol = max(1.0, abs(v) * 0.02)
    return float(v) if any(abs(abs(n) - abs(v)) <= tol for n in numbers) else None


def clean(project: str, raw: dict, numbers: list[float]) -> dict:
    ids = list(PROJECTS[project]["sections"])
    secs = raw.get("sections") or {}
    missing = [sid for sid in ids if not (secs.get(sid) or {}).get("insight")]
    if missing:
        raise ValueError(f"no insight for {', '.join(missing)}")
    out_secs = {}
    for sid in ids:
        s = secs[sid]
        actions = []
        for a in (s.get("actions") or [])[:3]:
            if isinstance(a, str):
                a = {"do": a, "owner": "", "when": ""}
            actions.append({"do": tidy(a.get("do")), "owner": tidy(a.get("owner")), "when": tidy(a.get("when"))})
        value = grounded(s.get("value_zar"), numbers)
        out_secs[sid] = {
            "insight": tidy(s.get("insight")),
            "why": tidy(s.get("why")),
            "actions": [a for a in actions if a["do"]],
            "value_zar": value,
            "value_note": tidy(s.get("value_note")) if value is not None else "",
            "confidence": s.get("confidence") if s.get("confidence") in ("High", "Medium", "Low") else "Medium",
        }
    o = raw.get("overview") or {}
    pris = []
    for p in (o.get("priorities") or [])[:5]:
        if p.get("section") not in ids or not p.get("action"):
            continue
        pris.append({
            "section": p["section"],
            "action": tidy(p.get("action")),
            "owner": tidy(p.get("owner")),
            "horizon": tidy(p.get("horizon")),
            "value_zar": grounded(p.get("value_zar"), numbers),
        })
    if not o.get("headline"):
        raise ValueError("no overview headline")
    return {
        "overview": {"headline": tidy(o.get("headline")), "summary": tidy(o.get("summary")), "priorities": pris},
        "sections": out_secs,
    }


# ---------------------------------------------------------------- main


def write_project(project: str, provider: str | None, dry_run: bool) -> bool:
    print(f"== {project}")
    compact = provider in OPENAI_COMPATIBLE and OPENAI_COMPATIBLE[provider][4]
    context, numbers, meta = build_context(project, compact=bool(compact))
    system, user = prompts(project, context)
    if dry_run:
        print(f"  {len(system) + len(user):,} characters of prompt, {len(numbers):,} grounding figures")
        print(user[:3000])
        return True
    if not provider:
        print("  no provider key found, keeping the existing insights")
        return True

    schema = schema_for(project)
    try:
        if provider == "anthropic":
            model = os.environ.get("AI_MODEL") or ANTHROPIC_DEFAULT_MODEL
            raw, served = call_anthropic(system, user, schema, model)
            label = "Anthropic"
        elif provider in OPENAI_COMPATIBLE:
            model = os.environ.get("AI_MODEL") or OPENAI_COMPATIBLE[provider][2]
            raw, served = call_openai_compatible(provider, system, user, schema, model)
            label = OPENAI_COMPATIBLE[provider][3]
        else:
            raise RuntimeError(f"unknown provider {provider!r}")
        result = clean(project, raw, numbers)
    except Exception as e:
        print(f"  {provider} failed, keeping the existing insights: {e}", file=sys.stderr)
        return False

    out = {
        "version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "generator": {"provider": label, "model": served, "model_label": model_label(served)},
        "data_through": meta.get("data_through"),
        **result,
    }
    path = PROJECTS_DIR / project / "dashboard" / "data" / "insights.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  written by {out['generator']['model_label']} via {label}")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--project", default="all", help='one project folder, or "all"')
    ap.add_argument("--dry-run", action="store_true", help="print the context and call nothing")
    ap.add_argument("--strict", action="store_true", help="exit 1 if any project could not be written")
    args = ap.parse_args()

    projects = list(PROJECTS) if args.project in ("", "all") else [args.project]
    unknown = [p for p in projects if p not in PROJECTS]
    if unknown:
        print(f"unknown project: {', '.join(unknown)}", file=sys.stderr)
        return 2

    provider = choose_provider()
    print(f"provider: {provider or 'none configured'}")
    ok = all([write_project(p, provider, args.dry_run) for p in projects])
    return 0 if ok or not args.strict else 1


if __name__ == "__main__":
    sys.exit(main())
