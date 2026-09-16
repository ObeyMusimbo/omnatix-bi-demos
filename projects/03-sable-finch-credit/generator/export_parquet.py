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
    "loans": loans,
    "disbursed_zar": int(book),
    "tables": {t: {"rows": r, "bytes": b} for t, r, b in manifest},
    "currency": "ZAR",
    "vat": "excluded",
}
(OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"  data through {meta['data_through']}, built {meta['built_at']}")
