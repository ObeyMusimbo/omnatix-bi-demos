"""Scratch probe. Not part of the build.

Reads the built warehouse and prints the numbers the dashboard copy will have to match.
Every claim written on the page gets checked here first, because copy that overclaims by a
few points is the failure mode that has bitten this repo more than once.
"""

import sys
import pathlib
import duckdb

sys.stdout.reconfigure(encoding="utf-8")

HERE = pathlib.Path(__file__).resolve().parent.parent
con = duckdb.connect(str(HERE / "lumen.duckdb"), read_only=True)


def show(title, sql):
    print("\n== " + title)
    try:
        rel = con.sql(sql)
        cols = rel.columns
        rows = rel.fetchall()
    except Exception as exc:                                   # noqa: BLE001
        print("  ERROR", exc)
        return
    widths = [max(len(str(c)), *(len(str(r[i])) for r in rows)) if rows else len(str(c))
              for i, c in enumerate(cols)]
    print("  " + "  ".join(str(c).ljust(widths[i]) for i, c in enumerate(cols)))
    for r in rows:
        print("  " + "  ".join(str(v).ljust(widths[i]) for i, v in enumerate(r)))


show("fill rate by weekday and half of day", """
select
    a.day_of_week,
    count(*) filter (where a.slot_hour < 12) as booked_am,
    count(*) filter (where a.slot_hour >= 12) as booked_pm,
    count(*) as booked
from main_silver.sl_appointments a
group by 1 order by 1
""")

show("capacity by weekday", """
select
    extract(isodow from s.session_date)::int as day_of_week,
    sum(s.slots_offered) as slots,
    round(sum(s.sessional_cost_zar)) as cost_zar
from main_silver.sl_sessions s
group by 1 order by 1
""")

show("no show by lead band and reminder", """
select
    a.booking_lead_band,
    a.reminder_sent,
    count(*) as appts,
    round(100.0 * count(*) filter (where a.is_no_show) / count(*), 1) as no_show_pct
from main_silver.sl_appointments a
group by 1, 2 order by 1, 2
""")

show("claims by status", """
select
    c.status,
    count(*) as claims,
    round(sum(c.claimed_zar)) as claimed,
    round(sum(c.paid_zar)) as paid,
    round(sum(c.shortfall_zar)) as shortfall
from main_silver.sl_claims c
group by 1 order by 3 desc
""")

show("rework by clinic", """
select
    a.clinic_code,
    count(*) filter (where c.is_outstanding) as denied,
    round(100.0 * count(*) filter (where c.is_outstanding and c.resubmitted) /
          nullif(count(*) filter (where c.is_outstanding), 0), 1) as reworked_pct,
    round(sum(c.shortfall_zar) filter (where c.is_outstanding)) as lost_zar
from main_silver.sl_claims c
join main_silver.sl_appointments a using (appointment_id)
group by 1 order by 4 desc
""")

show("rejection reasons", """
select
    c.rejection_reason,
    count(*) as claims,
    round(sum(c.shortfall_zar)) as shortfall,
    round(100.0 * count(*) filter (where c.resubmitted) / count(*), 1) as reworked_pct
from main_silver.sl_claims c
where c.is_outstanding
group by 1 order by 3 desc
""")

show("scheme settlement", """
select
    s.scheme_name,
    count(*) as claims,
    round(avg(c.days_to_settle), 1) as avg_days,
    round(100.0 * count(*) filter (where c.is_outstanding) / count(*), 1) as denial_pct,
    round(sum(c.claimed_zar)) as claimed
from main_silver.sl_claims c
join main_silver.sl_schemes s using (scheme_code)
group by 1 order by 3 desc
""")

show("practitioner fill spread", """
with cap as (
    select practitioner_id, sum(slots_offered) as slots, sum(sessional_cost_zar) as cost
    from main_silver.sl_sessions group by 1
),
bk as (
    select s.practitioner_id, count(a.appointment_id) as booked,
           count(a.appointment_id) filter (where a.is_attended) as attended
    from main_silver.sl_sessions s
    left join main_silver.sl_appointments a on a.session_id = s.session_id
    group by 1
)
select
    p.discipline,
    count(*) as practitioners,
    round(100.0 * min(bk.booked::double / cap.slots), 1) as min_fill,
    round(100.0 * median(bk.booked::double / cap.slots), 1) as median_fill,
    round(100.0 * max(bk.booked::double / cap.slots), 1) as max_fill
from cap join bk using (practitioner_id)
join main_silver.sl_practitioners p using (practitioner_id)
group by 1 order by 5 desc
""")

show("patient payments", """
select
    p.payment_type,
    count(*) as lines,
    round(sum(p.amount_due_zar)) as due,
    round(sum(p.amount_paid_zar)) as paid,
    round(100.0 * sum(p.amount_paid_zar) / nullif(sum(p.amount_due_zar), 0), 1) as collected_pct
from main_silver.sl_patient_payments p
group by 1 order by 3 desc
""")

show("longest waits", """
select
    a.day_of_week, a.slot_hour, count(*) as seen, round(avg(a.wait_minutes), 1) as avg_wait
from main_silver.sl_appointments a
where a.is_attended
group by 1, 2 order by 4 desc limit 6
""")

show("shortest waits", """
select
    a.day_of_week, a.slot_hour, count(*) as seen, round(avg(a.wait_minutes), 1) as avg_wait
from main_silver.sl_appointments a
where a.is_attended
group by 1, 2 order by 4 asc limit 6
""")

show("totals", """
select
    (select count(*) from main_silver.sl_appointments) as appointments,
    (select sum(slots_offered) from main_silver.sl_sessions) as slots,
    (select round(sum(billed_zar)) from main_silver.sl_encounters) as billed,
    (select round(sum(sessional_cost_zar)) from main_silver.sl_sessions) as clinician_cost,
    (select round(sum(paid_zar)) from main_silver.sl_claims) as scheme_paid,
    (select round(sum(amount_paid_zar)) from main_silver.sl_patient_payments) as patient_paid
""")

show("data quality", """
select
    (select count(*) from main_silver.sl_encounters where icd10_missing) as icd10_missing,
    (select count(*) from main_silver.sl_patient_payments where not appointment_is_known) as orphan_payments,
    (select count(*) from main_silver.sl_claims where was_submitted_twice) as duplicate_claims,
    (select count(*) from main_silver.sl_appointments where status is null) as unmapped_status,
    (select count(*) from main_silver.sl_appointments a
       left join main_silver.sl_sessions s using (session_id)
      where s.session_id is null) as orphan_appointments
""")

con.close()
