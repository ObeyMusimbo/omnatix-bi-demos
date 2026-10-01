"""
Write the context pack each dashboard's Ask box is grounded in.

    .venv/Scripts/python.exe scripts/chat_context.py                  every project
    .venv/Scripts/python.exe scripts/chat_context.py --project 04-lumen-health

One file per project, dashboard/data/chat-context.json, read by functions/api/chat.js. It holds
what the model needs to write correct SQL against the tables the page itself loads, and nothing
else: each table's name, row count and meaning, each column's type and definition, and the exact
values of every short category column, so a question about "Summit" becomes a filter on
'Summit Cash & Carry' rather than a guess.

The definitions come from the gold layer's _gold__models.yml, the same descriptions the dbt docs
site shows, which is why those descriptions are written as definitions rather than labels. The
tables come from the page's own db.js, so the model is never told about a table the browser
cannot query. Rerun after every refresh; the nightly workflow does.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

import duckdb
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from ai_insights import PROJECTS as INFO  # noqa: E402  the client, business and rules live there once

# The URL each dashboard is published under, the column that holds its one filter's code, and
# a few questions to offer as starting points.
DEMOS = {
    "01-meridian-provisions": {
        "slug": "meridian",
        "filter_column": "warehouse_code",
        "examples": [
            "Which brands lose money after freight and rebates?",
            "How did Summit Cash & Carry's realised discount change by month?",
            "Which products lost the most revenue to weekend stock-outs?",
            "What was gross margin in each of the last six months?",
        ],
    },
    "02-kestrel-logistics": {
        "slug": "kestrel",
        "filter_column": "origin_depot_code",
        "examples": [
            "Which corridors lose money as a round trip?",
            "Which sites refuse the most deliveries, and why?",
            "What is on time delivery on Fridays for Dedicated contracts?",
            "Which vehicles cost the most in excess fuel?",
        ],
    },
    "03-sable-finch-credit": {
        "slug": "sable-finch",
        "filter_column": "branch_code",
        "examples": [
            "How does Mahikeng's bad rate compare with the other branches?",
            "How many top-ups settled an account that was already in arrears?",
            "What is the first payment default rate by debit order timing?",
            "How has PAR 30 moved over the last six months?",
        ],
    },
    "04-lumen-health": {
        "slug": "lumen",
        "filter_column": "clinic_code",
        "examples": [
            "Which clinic recovers the fewest rejected claims?",
            "What is the no-show rate with and without a reminder?",
            "Which hours are fullest on a Friday?",
            "Which practitioners cost the most per visit against their peers?",
        ],
    },
}

MAX_VALUES = 40          # list the values of a text column with this many distinct values or fewer
MAX_DESC = 320           # characters of a column definition


def page_tables(project: str) -> list[str]:
    """The tables the browser registers, read from the page's own db.js."""
    js = (ROOT / "projects" / project / "dashboard" / "assets" / "db.js").read_text(encoding="utf-8")
    block = re.search(r"const TABLES = \[(.*?)\];", js, re.S).group(1)
    return re.findall(r"'([a-z0-9_]+)'", block)


def gold_docs(project: str) -> dict:
    docs = yaml.safe_load((ROOT / "projects" / project / "dbt" / "models" / "gold" / "_gold__models.yml")
                          .read_text(encoding="utf-8"))
    out = {}
    for m in docs.get("models", []):
        out[m["name"]] = {
            "description": " ".join(str(m.get("description", "")).split()),
            "columns": {c["name"]: " ".join(str(c.get("description", "")).split()) for c in m.get("columns", [])},
        }
    return out


def clip(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


def build(project: str) -> dict:
    demo = DEMOS[project]
    info = INFO[project]
    data = ROOT / "projects" / project / "dashboard" / "data"
    meta = json.loads((data / "meta.json").read_text(encoding="utf-8"))
    docs = gold_docs(project)

    con = duckdb.connect()
    tables = []
    for t in page_tables(project):
        path = (data / f"{t}.parquet").as_posix()
        con.execute(f"create view {t} as select * from read_parquet('{path}')")
        rows = con.execute(f"select count(*) from {t}").fetchone()[0]
        doc = docs.get(t, {"description": "", "columns": {}})
        cols = []
        for name, ctype, *_ in con.execute(f"describe {t}").fetchall():
            col = {"name": name, "type": ctype}
            desc = doc["columns"].get(name, "")
            if desc:
                col["description"] = clip(desc, MAX_DESC)
            if ctype == "VARCHAR":
                n = con.execute(f'select count(distinct "{name}") from {t}').fetchone()[0]
                if 0 < n <= MAX_VALUES:
                    col["values"] = [v for (v,) in con.execute(
                        f'select distinct "{name}" from {t} where "{name}" is not null order by 1').fetchall()]
            elif ctype in ("DATE", "TIMESTAMP"):
                lo, hi = con.execute(f'select min("{name}"), max("{name}") from {t}').fetchone()
                col["range"] = [str(lo), str(hi)]
            cols.append(col)
        tables.append({
            "name": t,
            "rows": rows,
            "description": clip(doc["description"], 600),
            "columns": cols,
        })

    summary = meta.get("summary") or {}
    return {
        "version": 1,
        "demo": demo["slug"],
        "client": info["client"],
        "business": info["business"],
        "reader": info["reader"],
        "rules": info["rules"],
        "sections": info["sections"],
        "data_from": meta.get("data_from"),
        "data_through": meta.get("data_through"),
        "summary": {"hero": summary.get("hero"), "findings": summary.get("findings", [])},
        "filter": {**(summary.get("filter") or {}), "column": demo["filter_column"]},
        "examples": demo["examples"],
        "tables": tables,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--project", default="all", help='one project folder, or "all"')
    ap.add_argument("--out-dir", default="",
                    help="write <project>.json here instead of into the project, then copy it in "
                         "(for a machine whose folder protection blocks Python writing to the repo)")
    args = ap.parse_args()
    projects = list(DEMOS) if args.project in ("", "all") else [args.project]
    for p in projects:
        if p not in DEMOS:
            print(f"unknown project: {p}", file=sys.stderr)
            return 2
        ctx = build(p)
        out = (pathlib.Path(args.out_dir) / f"{p}.json" if args.out_dir
               else ROOT / "projects" / p / "dashboard" / "data" / "chat-context.json")
        text = json.dumps(ctx, ensure_ascii=False, indent=1, default=str)
        out.write_text(text + "\n", encoding="utf-8")
        cols = sum(len(t["columns"]) for t in ctx["tables"])
        print(f"{p}: {len(ctx['tables'])} tables, {cols} columns, {len(text):,} characters")
    return 0


if __name__ == "__main__":
    sys.exit(main())
