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
    # Synthetic demo data covers a closed period and never advances, so the dashboard tracks
    # the nightly rebuild rather than counting days since the newest row. A client deployment
    # on live data leaves this out and gets the days-behind alarm.
    "fixed_period": True,
    "appointments": appointments,
    "billed_zar": int(billed),
    "clinics": clinics,
    "practitioners": practitioners,
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


b = one("""
    select total_leakage_zar, leakage_pct_of_billed
    from main_gold.mart_collection_bridge where step_order = 1
""")
cap = one("select all_empty_pct, all_unfilled_cost_zar + all_no_show_cost_zar "
          "from main_gold.mart_capacity_cost limit 1")
claims = one("select all_outstanding_zar from main_gold.mart_claim_recovery limit 1")[0]
noshow = one("select all_recoverable_zar from main_gold.mart_no_show limit 1")[0]
gap = one("select sum(patient_due_zar) - sum(patient_paid_zar) from main_gold.mart_clinic")[0]
dearest = one("""
    select max(cost_ratio_vs_peers) from main_gold.mart_practitioner where peers >= 3
""")[0]

meta["summary"] = {
    "hero": {
        "v": b[0], "f": "R",
        "label": f"billed for care already delivered and never collected, which is "
                 f"{b[1]:.1f}% of everything the group invoiced",
    },
    "findings": [
        {"n": "02", "id": "week", "title": "Empty chairs",
         "v": cap[0], "f": "pct",
         "note": f"of paid clinician time had nobody in the chair, R{cap[1] / 1e6:.1f}m of it"},
        {"n": "03", "id": "claims", "title": "Claims nobody worked",
         "v": claims, "f": "Rc", "note": "rejected or short paid and never recovered"},
        {"n": "04", "id": "noshow", "title": "Patients who never arrived",
         "v": noshow, "f": "Rc", "note": "of visits recoverable with a reminder SMS"},
        {"n": "05", "id": "reception", "title": "The gap at reception",
         "v": gap, "f": "Rc", "note": "owed by patients and never asked for"},
        {"n": "06", "id": "diaries", "title": "Different diaries",
         "v": dearest, "f": "x", "note": "the dearest cost per visit against discipline peers"},
    ],
    # Clinic is the cut the claims, patient charge and practitioner marts carry. The diary grid,
    # the no-show mart, the schemes and the bridge are group-wide and say so.
    "filter": {
        "param": "clinic", "label": "Clinic", "all": "All clinics",
        "options": [{"value": c, "label": n.replace("Lumen ", "")} for c, n in con.execute(
            "select distinct clinic_code, clinic_name from main_gold.mart_clinic "
            "order by 2").fetchall()],
    },
}

(OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"  data through {meta['data_through']}, built {meta['built_at']}")
