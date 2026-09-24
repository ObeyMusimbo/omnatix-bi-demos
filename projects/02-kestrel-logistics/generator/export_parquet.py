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

# ---------------------------------------------------------------- summary
#
# The headline and one figure per finding, painted from this file in the first second, before
# the in-browser query engine has downloaded. Every number is read from the same gold column
# the page itself reads for that section, so the strip and the section cannot disagree. The
# page formats them, by the name in "f", with the same functions it uses everywhere else.


def one(sql):
    return con.execute(sql).fetchone()


bridge = {r[0]: r[1] for r in con.execute(
    "select driver_short, effect_zar from main_gold.mart_opportunity_bridge").fetchall()}
head = one("""
    select identified_zar, ttm_contribution_zar, identified_pct_of_contribution
    from main_gold.mart_opportunity_bridge where step_order = 1
""")
empty_pct = one("""
    select sum(empty_distance_km) * 100.0 / sum(distance_km)
    from main_gold.agg_trip_monthly where is_trailing_twelve_months
""")[0]
traps = one("""
    select count(*) from main_gold.mart_lane_economics
    where period_order = 1 and lane_type = 'Line-haul' and is_backhaul_trap
""")[0]
problem_sites = one("""
    select count(*) from (
        select customer_name from main_gold.mart_failed_deliveries
        where is_trailing_twelve_months group by 1
        having sum(failed_drops) * 1.0 / sum(drops) > 0.15)
""")[0]
thirsty = one("select count(*) from main_gold.mart_fuel_outliers where is_outlier")[0]
air_trips = one("select sum(air_trips) from main_gold.mart_load_factor")[0]

meta["summary"] = {
    "hero": {
        "v": empty_pct, "f": "pct",
        "label": "of every kilometre this fleet turned in the last twelve months carried nothing at all",
    },
    "findings": [
        {"n": "01", "id": "corridors", "title": "Empty return legs",
         "v": bridge["Empty returns"], "f": "Rc", "note": f"lost a year on {traps} corridors"},
        {"n": "02", "id": "doors", "title": "Deliveries done twice",
         "v": bridge["Redeliveries"], "f": "Rc", "note": f"a year, {problem_sites} sites cause most of it"},
        {"n": "03", "id": "thirsty", "title": "Thirsty trucks",
         "v": bridge["Thirsty vehicles"], "f": "Rc", "note": f"a year of excess diesel on {thirsty} vehicles"},
        {"n": "04", "id": "friday", "title": "Friday dispatch",
         "v": bridge["Service penalties"], "f": "Rc", "note": "a year in service penalties"},
        {"n": "05", "id": "air", "title": "Paying to move air",
         "v": air_trips, "f": "num", "note": "trips full by volume, light by weight"},
        {"n": "06", "id": "close", "title": "What it is worth", "close": True,
         "v": head[0], "f": "Rc",
         "note": f"{head[2]:.1f}% of the R{head[1] / 1e6:.1f}m the business earns"},
    ],
    # The one filter this demo offers. Hub is the only cut most of Kestrel's gold layer carries.
    "filter": {
        "param": "hub", "label": "Hub", "all": "All hubs",
        "options": [{"value": c, "label": n.replace("Kestrel ", "")} for c, n in con.execute(
            "select distinct origin_depot_code, origin_depot_name "
            "from main_gold.mart_lane_economics order by 2").fetchall()],
    },
}

(OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"  data through {meta['data_through']}, built {meta['built_at']}")
