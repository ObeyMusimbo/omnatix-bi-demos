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
DB = PROJECT / "kestrel.duckdb"
OUT = PROJECT / "dashboard" / "data"

# Deliberately not fct_trip or fct_consignment: 50k and 160k rows would dominate the payload
# and nothing on the page needs leg or drop grain.
TABLES = [
    "mart_opportunity_bridge",
    "mart_lane_economics",
    "mart_failed_deliveries",
    "mart_fuel_outliers",
    "mart_sla_performance",
    "mart_load_factor",
    "agg_trip_monthly",
    "dim_lane",
    "dim_vehicle",
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
    print(f"  {t:<28} {rows:>8,} rows   {size / 1024:>8.1f} KB")

print(f"\n  {len(TABLES)} files, {total / 1024:.0f} KB total -> {OUT}")
if total > 5 * 1024 * 1024:
    print("  WARNING: over 5 MB. Trim a table or pre-aggregate further before shipping.")

# Freshness, stated on the page against the reader's own clock. Two facts, because they fail
# separately: how old the newest trip is, and when this pipeline last ran.
data_from, data_through = con.execute(
    "select min(trip_date), max(trip_date) from main_gold.fct_trip"
).fetchone()
trips, km = con.execute(
    "select count(*), round(sum(distance_km)) from main_gold.fct_trip"
).fetchone()

meta = {
    "built_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "data_from": data_from.isoformat(),
    "data_through": data_through.isoformat(),
    # Synthetic demo data covers a closed period and never advances, so the dashboard tracks
    # the nightly rebuild rather than counting days since the newest row. A client deployment
    # on live data leaves this out and gets the days-behind alarm.
    "fixed_period": True,
    "trips": trips,
    "kilometres": int(km),
    "tables": {t: {"rows": r, "bytes": b} for t, r, b in manifest},
    "currency": "ZAR",
    "vat": "excluded",
}
(OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"  data through {meta['data_through']}, built {meta['built_at']}")
