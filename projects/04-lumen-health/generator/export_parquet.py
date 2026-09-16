"""
Export the gold layer to Parquet for the browser.

Same contract as the other three demos: the dashboard is a static site, DuckDB-WASM loads
these over HTTP and queries them client side, so there is no server and no database to host.
Only gold is exported, and only what the page or a grounded chat actually needs.

Run after `dbt build`:
    ../../.venv/Scripts/python.exe generator/export_parquet.py
"""

from datetime import datetime, timezone
from pathlib import Path
import json
import duckdb

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
DB = PROJECT / "lumen.duckdb"
OUT = PROJECT / "dashboard" / "data"

# Deliberately not fct_appointment or fct_capacity_hour: 233k and 146k rows would dominate the
# payload and nothing on the page needs visit or session-hour grain. Everything the page draws
# is already aggregated to a grid, a band or a site.
TABLES = [
    "mart_collection_bridge",
    "mart_slot_grid",
    "mart_capacity_cost",
    "mart_no_show",
    "mart_claim_recovery",
    "mart_patient_charges",
    "mart_scheme",
    "mart_practitioner",
    "mart_clinic",
    "mart_data_quality",
    "agg_monthly",
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
# separately: how recent the newest appointment is, and when this pipeline last ran.
data_from, data_through = con.execute(
    "select min(scheduled_date), max(scheduled_date) from main_gold.fct_appointment"
).fetchone()
appointments, billed = con.execute(
    "select count(*), round(sum(billed_zar)) from main_gold.fct_appointment"
).fetchone()
clinics, practitioners = con.execute(
    "select (select count(*) from main_gold.dim_clinic), "
    "(select count(*) from main_gold.dim_practitioner)"
).fetchone()

meta = {
    "built_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "data_from": data_from.isoformat(),
    "data_through": data_through.isoformat(),
    "appointments": appointments,
    "billed_zar": int(billed),
    "clinics": clinics,
    "practitioners": practitioners,
    "tables": {t: {"rows": r, "bytes": b} for t, r, b in manifest},
    "currency": "ZAR",
    "vat": "excluded",
}
(OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"  data through {meta['data_through']}, built {meta['built_at']}")
