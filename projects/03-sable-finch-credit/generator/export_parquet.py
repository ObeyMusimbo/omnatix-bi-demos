"""
Export the gold layer to Parquet for the browser.

Same contract as Meridian: the dashboard is a static site, DuckDB-WASM loads these over HTTP
and queries them client side, so there is no server and no database to host. Only gold is
exported, and only what the page or a grounded chat actually needs.

Run after `dbt build`:
    ../../.venv/Scripts/python.exe generator/export_parquet.py
"""

from datetime import datetime, timezone
from pathlib import Path
import json
import duckdb

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
DB = PROJECT / "sable.duckdb"
OUT = PROJECT / "dashboard" / "data"

# Deliberately not fct_trip or fct_consignment: 50k and 160k rows would dominate the payload
# and nothing on the page needs leg or drop grain.
TABLES = [
    "mart_exposure_bridge",
    "mart_vintage",
    "mart_branch_risk",
    "mart_affordability",
    "mart_topup_masking",
    "mart_debit_order",
    "mart_collections",
    "agg_book_monthly",
    "dim_branch",
]

OUT.mkdir(parents=True, exist_ok=True)
con = duckdb.connect(str(DB), read_only=True)

total = 0
manifest = []
for t in TABLES:
    dest = OUT / f"{t}.parquet"
    con.execute(
        f"copy (select * from main_gold.{t}) to '{dest.as_posix()}' "
        "(format parquet, compression zstd)"
    )
    rows = con.execute(f"select count(*) from main_gold.{t}").fetchone()[0]
    size = dest.stat().st_size
    total += size
    manifest.append((t, rows, size))
    print(f"  {t:<28} {rows:>8,} rows   {size / 1024:>8.1f} KB")

print(f"\n  {len(TABLES)} files, {total / 1024:.0f} KB total -> {OUT}")
if total > 5 * 1024 * 1024:
    print("  WARNING: over 5 MB. Trim a table or pre-aggregate further before shipping.")

# Freshness, stated on the page against the reader's own clock. Two facts, because they fail
# separately: how old the newest trip is, and when this pipeline last ran.
data_from, data_through = con.execute(
    "select min(disbursement_date), max(snapshot_date) from main_gold.dim_loan, main_gold.fct_loan_month"
).fetchone()
loans, book = con.execute(
    "select count(*), round(sum(principal_zar)) from main_gold.dim_loan"
).fetchone()

meta = {
    "built_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "data_from": data_from.isoformat(),
    "data_through": data_through.isoformat(),
    # Synthetic demo data covers a closed period and never advances, so the dashboard tracks
    # the nightly rebuild rather than counting days since the newest row. A client deployment
    # on live data leaves this out and gets the days-behind alarm.
    "fixed_period": True,
    "loans": loans,
    "disbursed_zar": int(book),
    "tables": {t: {"rows": r, "bytes": b} for t, r, b in manifest},
    "currency": "ZAR",
    "vat": "excluded",
}

# ---------------------------------------------------------------- summary
#
# The headline and one figure per finding, painted from this file in the first second, before
# the in-browser query engine has downloaded. Every number is read from the same gold column
# the page itself reads for that section, so the strip and the section cannot disagree. The
# page formats them, by the name in "f", with the same functions it uses everywhere else.


def one(sql):
    return con.execute(sql).fetchone()


# The headline repeats the page's own arithmetic exactly: the month six bad rate per cohort,
# rounded as the page's query rounds it, then the three newest cohorts with a month six
# reading against the three oldest. The page checks the two agree and warns if they do not.
at_six = dict(con.execute("""
    select cohort_label,
           round(sum(bad_principal_zar) / nullif(sum(cohort_principal_zar), 0) * 100, 3)
    from main_gold.mart_vintage where months_on_book = 6 group by 1
""").fetchall())
labels = sorted(at_six)
early = sum(at_six[x] for x in labels[:3]) / 3
recent = sum(at_six[x] for x in labels[-3:]) / 3

h = one("""
    select total_loss_zar, total_excess_zar, reckless_exposure_zar, reckless_loans
    from main_gold.mart_exposure_bridge where step_order = 1
""")
branch = one("""
    select branch_name, round(avg(bad_rate_vs_book_x), 2) as x
    from main_gold.mart_branch_risk where cohort_month >= date '2025-05-01'
    group by branch_code, branch_name, province order by x desc limit 1
""")
topups = one("""
    select count(*), count(*) filter (where settled_account_was_delinquent)
    from main_gold.mart_topup_masking
""")
debit = con.execute("""
    select round(sum(first_payment_defaults) * 100.0 / nullif(sum(loans), 0), 2)
    from main_gold.mart_debit_order group by timing_band order by min(days_after_payday)
""").fetchall()
cure = dict(con.execute(
    "select arrears_bucket, cost_per_cure_zar from main_gold.mart_collections").fetchall())

meta["summary"] = {
    "hero": {
        "v": (recent / early - 1) * 100, "f": "signedPct0",
        "label": "worse at month six than the cohorts written a year ago, on the same product",
    },
    "findings": [
        {"n": "02", "id": "branch", "title": "One branch turned",
         "v": branch[1], "f": "x", "note": f"{branch[0]}'s loss rate against the book, since May 2025"},
        {"n": "03", "id": "afford", "title": "Nothing left over",
         "v": h[2], "f": "Rc", "note": f"outstanding on {h[3]:,} agreements a court could set aside".replace(",", " ")},
        {"n": "04", "id": "topups", "title": "Arrears refinanced",
         "v": topups[1], "f": "num", "note": f"of {topups[0]} top-ups settled an account already in arrears"},
        {"n": "05", "id": "debit", "title": "Debit order timing",
         "v": debit[-1][0], "f": "pct",
         "note": f"of first instalments fail a week after payday, against {debit[0][0]:.1f}%"},
        {"n": "06", "id": "collections", "title": "Collections effort",
         "v": cure["90+"], "f": "R", "note": f"to cure one account past 90 days, against R{cure['1-30']:.0f} in month one"},
        {"n": "07", "id": "close", "title": "What it adds up to", "close": True,
         "v": h[1], "f": "Rc", "note": f"of the R{h[0] / 1e6:.1f}m credit loss sits with these four conditions"},
    ],
    # Branch is the cut the credit story turns on. The curves, the branch comparison, the
    # affordability and the top-up marts carry it; PAR, debit orders, collections and the
    # bridge are book-wide and say so.
    "filter": {
        "param": "branch", "label": "Branch", "all": "All branches",
        "options": [{"value": c, "label": n} for c, n in con.execute(
            "select distinct branch_code, branch_name from main_gold.mart_branch_risk "
            "order by 2").fetchall()],
    },
}

(OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"  data through {meta['data_through']}, built {meta['built_at']}")
