"""
Export the gold layer to Parquet for the browser.

The dashboard is a static site: DuckDB-WASM loads these files over HTTP and queries them
client-side, so there is no server and no database to host. Only gold is exported, the
browser has no business seeing bronze or silver, and the marts are small enough that the
whole dashboard is a few hundred kilobytes.

Run after `dbt build`:
    ../../.venv/Scripts/python.exe generator/export_parquet.py
"""

from datetime import datetime, timezone
from pathlib import Path
import json
import duckdb

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
DB = PROJECT / "meridian.duckdb"
OUT = PROJECT / "dashboard" / "data"

# Everything the dashboard or a grounded chat needs. Deliberately not fct_sales_line:
# 288k rows would dominate the payload and nothing on the page needs line grain.
TABLES = [
    "mart_gp_bridge",
    "mart_margin_waterfall",
    "mart_promo_performance",
    "mart_discount_trend",
    "mart_stockout_impact",
    "mart_dead_stock",
    "agg_sales_monthly",
    "agg_product_month",
    "dim_product",
    "dim_customer",
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
    print(f"  {t:<26} {rows:>8,} rows   {size / 1024:>8.1f} KB")

print(f"\n  {len(TABLES)} files, {total / 1024:.0f} KB total -> {OUT}")
if total > 5 * 1024 * 1024:
    print("  WARNING: over 5 MB. Trim a table or pre-aggregate further before shipping.")

# ---------------------------------------------------------------- freshness
#
# The dashboard states how current it is, because a number with no date on it is worth
# very little to whoever has to act on it. Two facts matter and they are different:
# how recent the newest transaction is (source latency, usually someone else's problem),
# and when this pipeline last ran (our problem).

data_from, data_through = con.execute(
    "select min(order_date), max(order_date) from main_gold.fct_sales_line"
).fetchone()
order_rows, line_rows = con.execute(
    "select count(distinct order_id), count(*) from main_gold.fct_sales_line"
).fetchone()

meta = {
    "built_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "data_from": data_from.isoformat(),
    "data_through": data_through.isoformat(),
    "orders": order_rows,
    "sales_lines": line_rows,
    "tables": {t: {"rows": r, "bytes": b} for t, r, b in manifest},
    "currency": "ZAR",
    "vat": "excluded",
}
(OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"  data through {meta['data_through']}, built {meta['built_at']}")
