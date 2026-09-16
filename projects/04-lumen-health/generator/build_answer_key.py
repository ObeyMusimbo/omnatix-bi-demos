"""
Write ANSWER_KEY.md from the built warehouse.

Derived from gold, never recomputed alongside it, so the reveal script and the dashboard
cannot drift apart.

Run after `dbt build`:
    ../../.venv/Scripts/python.exe generator/build_answer_key.py
"""

from pathlib import Path
import duckdb

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
DB = PROJECT / "lumen.duckdb"
OUT = PROJECT / "ANSWER_KEY.md"

con = duckdb.connect(str(DB), read_only=True)
one = lambda sql: con.execute(sql).fetchone()
rows = lambda sql: con.execute(sql).fetchall()


def rand(n, dp=0):
    if n is None:
        return "n/a"
    return ("-R" if n < 0 else "R") + f"{abs(n):,.{dp}f}"


def pct(n, dp=1):
    return "n/a" if n is None else f"{n:.{dp}f}%"


def num(n):
    return "n/a" if n is None else f"{n:,.0f}"


# ---------------------------------------------------------------- the headline

period_from, period_through = one(
    "select min(scheduled_date), max(scheduled_date) from main_gold.fct_appointment")

head = one("""
    select any_value(billed_zar), any_value(cash_received_zar), any_value(total_leakage_zar),
           any_value(leakage_pct_of_billed), any_value(scheme_shortfall_zar),
           any_value(patient_shortfall_zar), any_value(reconciliation_gap_zar)
    from main_gold.mart_collection_bridge
""")
billed, cash, leak, leak_pct, scheme_short, patient_short, recon_gap = head

scale = one("""
    select count(*), count(*) filter (where is_attended),
           (select count(*) from main_gold.dim_clinic),
           (select count(*) from main_gold.dim_practitioner),
           (select count(distinct patient_ref) from main_gold.fct_appointment)
    from main_gold.fct_appointment
""")
appts, attended, clinics, practitioners, patients = scale

cap = one("""
    select any_value(all_slots), any_value(all_booked), any_value(all_unfilled),
           any_value(all_no_show), any_value(all_fill_pct), any_value(all_empty_pct),
           any_value(all_cost_zar), any_value(all_unfilled_cost_zar),
           any_value(all_no_show_cost_zar), any_value(all_excess_cost_zar),
           any_value(all_excess_slots), any_value(target_fill_pct)
    from main_gold.mart_capacity_cost
""")
(slots, booked, unfilled, cap_no_show, fill_pct, empty_pct,
 cap_cost, unfilled_cost, no_show_cost, excess_cost, excess_slots, target_fill) = cap

bridge = rows("""
    select step_order, step_label, step_short, step_type, effect_zar, finding_ref
    from main_gold.mart_collection_bridge order by step_order
""")

# ---------------------------------------------------------------- finding 1

grid_worst = rows("""
    select day_name, slot_label, slots_offered, fill_pct, avg_wait_minutes
    from main_gold.mart_slot_grid
    where day_of_week between 1 and 5
    order by fill_pct asc limit 5
""")
grid_best = rows("""
    select day_name, slot_label, slots_offered, fill_pct, avg_wait_minutes
    from main_gold.mart_slot_grid
    where day_of_week between 1 and 5
    order by fill_pct desc limit 5
""")
by_day = rows("""
    select day_name,
           sum(slots_offered), sum(slots_booked),
           round(100.0 * sum(slots_booked) / sum(slots_offered), 1),
           round(sum(slots_unfilled * cost_per_slot_zar))
    from main_gold.mart_slot_grid
    group by day_of_week, day_name order by day_of_week
""")
lead_vs_fill = one("""
    select round(corr(fill_pct, avg_booking_lead_days), 2),
           round(min(avg_booking_lead_days), 1), round(max(avg_booking_lead_days), 1),
           -- Slope of no-show against lead time across the working week, so the sentence
           -- quotes what the data shows rather than what somebody remembered.
           round(regr_slope(no_show_pct, avg_booking_lead_days) * 6, 1),
           -- Fill and waiting time correlate positively: the two grids are the same shape,
           -- not opposites. An earlier draft called them mirror images, which is backwards.
           round((select corr(fill_pct, avg_wait_minutes) from main_gold.mart_slot_grid
                  where avg_wait_minutes is not null), 2)
    from main_gold.mart_slot_grid
    where day_of_week between 1 and 5
""")

# ---------------------------------------------------------------- finding 2

recovery_sites = rows("""
    select clinic_name, sum(ever_rejected), sum(recovered_claims),
           round(100.0 * sum(recovered_claims) / sum(ever_rejected), 1),
           round(sum(outstanding_zar))
    from main_gold.mart_claim_recovery
    group by 1 order by 4 asc
""")
recovery_totals = one("""
    select any_value(all_rejected), any_value(all_rejection_pct), any_value(all_recovered_zar),
           any_value(all_outstanding_zar), any_value(all_fixable_outstanding_zar),
           any_value(all_no_cover_outstanding_zar), any_value(all_claims)
    from main_gold.mart_claim_recovery
""")
(rej_claims, rej_pct, recovered_zar, outstanding_zar,
 fixable_zar, no_cover_zar, all_claims) = recovery_totals

reasons = rows("""
    select rejection_reason, rejection_class, sum(ever_rejected),
           round(100.0 * sum(recovered_claims) / sum(ever_rejected), 1),
           round(sum(outstanding_zar))
    from main_gold.mart_claim_recovery
    group by 1, 2 order by 5 desc
""")

# ---------------------------------------------------------------- finding 3

no_show = rows("""
    select booking_lead_band, reminder_sent, appointments, no_show_pct,
           recoverable_visits, recoverable_zar
    from main_gold.mart_no_show order by booking_lead_order, reminder_sent
""")
ns_totals = one("""
    select any_value(all_appointments), any_value(all_no_shows), any_value(all_no_show_pct),
           any_value(unreminded_pct), any_value(all_recoverable_visits),
           any_value(all_recoverable_zar), any_value(all_no_show_revenue_zar),
           any_value(revenue_per_visit_zar)
    from main_gold.mart_no_show
""")
(ns_appts, ns_count, ns_pct, unreminded_pct,
 ns_recoverable, ns_recoverable_zar, ns_revenue, rev_per_visit) = ns_totals

reminder_sites = rows("""
    select clinic_name, appointments, reminded_pct, no_show_pct, avg_lead_days
    from main_gold.mart_clinic order by reminded_pct asc
""")

# ---------------------------------------------------------------- finding 4

prac_spread = rows("""
    select discipline, count(*), round(min(fill_pct), 1), round(median(fill_pct), 1),
           round(max(fill_pct), 1), round(min(cost_per_attended_zar)),
           round(max(cost_per_attended_zar))
    from main_gold.mart_practitioner
    group by 1 having count(*) >= 3 order by count(*) desc
""")
prac_worst = rows("""
    select practitioner_name, discipline, clinic_name, session_rate_zar, fill_pct,
           cost_per_attended_zar, cost_ratio_vs_peers
    from main_gold.mart_practitioner
    where peers >= 3 order by cost_ratio_vs_peers desc limit 5
""")

# ---------------------------------------------------------------- finding 5

schemes = rows("""
    select scheme_name, claims, claimed_zar, denial_pct, avg_days_to_settle,
           days_beyond_group_median, working_capital_zar, gap_collected_pct
    from main_gold.mart_scheme order by claimed_zar desc
""")
gap = one("""
    select round(sum(patient_due_zar)), round(sum(patient_paid_zar)),
           round(100.0 * sum(patient_paid_zar) / sum(patient_due_zar), 1)
    from main_gold.mart_clinic
""")
gap_by_type = rows("""
    select payment_type, count(*), round(sum(amount_due_zar)), round(sum(amount_paid_zar)),
           round(100.0 * sum(amount_paid_zar) / nullif(sum(amount_due_zar), 0), 1)
    from main_silver.sl_patient_payments
    group by 1 order by 3 desc
""")
working_capital = one(
    "select round(sum(working_capital_zar)) from main_gold.mart_scheme")[0]
slow_scheme = one("""
    select scheme_name, round(working_capital_zar), round(avg_days_to_settle, 1),
           round(days_beyond_group_median, 1)
    from main_gold.mart_scheme order by working_capital_zar desc limit 1
""")

# ---------------------------------------------------------------- quality

quality = rows("""
    select issue, source_table, rows_affected, impact_zar
    from main_gold.mart_data_quality order by issue_order
""")

# ---------------------------------------------------------------- render

bridge_rows = ""
for _, label, _short, step_type, effect, ref in bridge:
    if step_type == "anchor":
        bridge_rows += f"| _{label}_ | _{rand(effect)}_ | |\n"
    elif step_type == "total":
        bridge_rows += f"| **{label}** | **{rand(effect)}** | |\n"
    else:
        bridge_rows += f"| {label} | {rand(effect)} | {ref or ''} |\n"

worst_rows = "".join(
    f"| {d} {t} | {num(s)} | {pct(f)} | {w} min |\n" for d, t, s, f, w in grid_worst)
best_rows = "".join(
    f"| {d} {t} | {num(s)} | {pct(f)} | {w} min |\n" for d, t, s, f, w in grid_best)
day_rows = "".join(
    f"| {d} | {num(o)} | {num(b)} | {pct(f)} | {rand(c)} |\n" for d, o, b, f, c in by_day)

site_recovery_rows = "".join(
    f"| {n} | {num(r)} | {num(rec)} | {pct(p)} | {rand(o)} |\n"
    for n, r, rec, p, o in recovery_sites)
reason_rows = "".join(
    f"| {r} | {cls} | {num(n)} | {pct(p)} | {rand(o)} |\n"
    for r, cls, n, p, o in reasons)

ns_rows = "".join(
    f"| {b} | {'yes' if rem else 'no'} | {num(a)} | {pct(p)} | "
    f"{num(v) if v else ''} | {rand(z) if z else ''} |\n"
    for b, rem, a, p, v, z in no_show)
reminder_rows = "".join(
    f"| {n} | {num(a)} | {pct(r)} | {pct(ns)} | {ld} days |\n"
    for n, a, r, ns, ld in reminder_sites)

prac_rows = "".join(
    f"| {d} | {n} | {pct(lo)} | {pct(med)} | {pct(hi)} | {rand(cheap)} | {rand(dear)} |\n"
    for d, n, lo, med, hi, cheap, dear in prac_spread)
prac_worst_rows = "".join(
    f"| {n} | {d} | {c} | {rand(rate)} | {pct(f)} | {rand(cost)} | {ratio}x |\n"
    for n, d, c, rate, f, cost, ratio in prac_worst)

scheme_rows = "".join(
    f"| {n} | {num(c)} | {rand(z)} | {pct(dp)} | {days} days | {rand(wc)} | {pct(g)} |\n"
    for n, c, z, dp, days, _beyond, wc, g in schemes)
gap_type_rows = "".join(
    f"| {t} | {num(n)} | {rand(d)} | {rand(p)} | {pct(c) if c is not None else 'n/a'} |\n"
    for t, n, d, p, c in gap_by_type)

quality_rows = "".join(
    f"| {i} | {s} | {num(r)} | {rand(z)} |\n" for i, s, r, z in quality)

doc = f"""# Lumen Health Network demo answer key

Derived from `lumen.duckdb` after `dbt build`. Every figure here is what the dashboard will
show, because it reads the same gold models.

Data covers {period_from} to {period_through}, {clinics} sites, {practitioners} practitioners,
{num(patients)} patients and {num(appts)} booked appointments. All money is South African rand,
excluding VAT.

**Do not ship this file with the demo.** It is the script for the reveal.

## The headline

| Measure | Over the window |
|---|---|
| Billed for care delivered | {rand(billed)} |
| Cash received for it | {rand(cash)} |
| **Never collected** | **{rand(leak)}** ({pct(leak_pct)} of everything billed) |
| Owed by schemes and never recovered | {rand(scheme_short)} |
| Owed by patients and never collected | {rand(patient_short)} |
| Bridge reconciliation gap | {rand(recon_gap, 2)} |

Open on the sentence, not the number. This practice saw {num(attended)} patients, billed for
every one of them, and collected on nine rands in ten. Nobody stole anything and nobody was
negligent. It leaked out through a claims inbox nobody opens and a card machine nobody reaches
for.

The reconciliation gap is zero and that is deliberate. Say so. Every rand of the shortfall
lands in exactly one bucket, and the buckets are defined by who has to do something about it.

## The close

| Step | Effect | Finding |
|---|---|---|
{bridge_rows}
Three actions, and they belong to three different people. The billing clerk works the
rejections. The receptionist asks for the gap before the patient stands up. The practice
manager raises an account when the scheme says there was no cover.

Do not promise full recovery. A four month claim deadline that has already passed is gone, and
some of the gap was never going to be collected. Half of this inside a year is a serious
result and it costs nothing but a process.

## The second number, and never add it to the first

| Measure | Over the window |
|---|---|
| Consulting slots offered | {num(slots)} |
| Slots booked | {num(booked)} ({pct(fill_pct)}) |
| Never booked | {num(unfilled)} |
| Booked and not arrived | {num(cap_no_show)} |
| **Chairs with nobody in them** | **{pct(empty_pct)}** |
| Clinician cost of the whole roster | {rand(cap_cost)} |
| Cost of slots never booked | {rand(unfilled_cost)} |
| Cost of slots booked and not arrived | {rand(no_show_cost)} |
| Capacity above a diary running at {pct(target_fill, 0)} | {num(excess_slots)} slots, {rand(excess_cost)} |

This is a cost that was incurred, not revenue that was foregone, so it never gets added to the
{rand(leak)}. If anybody in the room adds them, stop them: one of those numbers is money that
left the bank and the other is money that never arrived.

The excess figure is the conservative one and it is worth explaining. It does not assume a
single patient moves. It asks, cell by cell, how much capacity a diary at {pct(target_fill, 0)}
would need to serve the demand that already falls in that cell, and counts anything above it.

## Finding 1: the week is lopsided, and the roster is not

The roster is almost identical Monday to Friday. The demand is nothing like it.

| Weekday | Slots offered | Booked | Fill | Cost of the empty ones |
|---|---|---|---|---|
{day_rows}
The five emptiest hours in the working week:

| Cell | Slots | Fill | Average wait |
|---|---|---|---|
{worst_rows}
And the five fullest:

| Cell | Slots | Fill | Average wait |
|---|---|---|---|
{best_rows}
That is the whole finding in two tables. The same practice, the same clinicians, the same
rooms. On a Monday morning the rooms are {pct(grid_worst[0][3])} full. On a Friday afternoon
they are {pct(grid_best[0][3])} full and the patients who get in wait {grid_best[0][4]} minutes.

The link to finding 3, and state it in this order. How full a cell is and how far ahead it gets
booked move together almost exactly: the correlation across the working week is
{lead_vs_fill[0]}. The quietest hours are taken about {lead_vs_fill[1]} days ahead, the busiest
about {lead_vs_fill[2]}. The busy cells are booked further out because they are the only ones
left, and finding 3 shows that bookings made further out are the ones that do not arrive.

The relationship is tight, the size of it is modest, and both halves of that sentence matter.
Six extra days of lead time is worth about {lead_vs_fill[3]} no-shows in every hundred. Claim
that, not more. The diary imbalance is not the main cause of the no-show rate. It is a
contributor that runs in the direction that costs money, on top of a reminder problem that is
much larger.

One thing that is easy to say backwards, so rehearse it. Slot fill and waiting time correlate
at **{lead_vs_fill[4]}**, which is positive: the two grids are nearly the same shape, not
mirror images of one another. The hours that fill are the hours people queue in, and the hours
nobody wants have no wait at all. Capacity is not short, it is in the wrong place.

## Finding 2: rejected claims that nobody worked

{num(rej_claims)} claims came back rejected or short paid, {pct(rej_pct)} of everything
submitted. {rand(recovered_zar)} was recovered by resubmitting. **{rand(outstanding_zar)} was
not.**

The scheme allows four months from the date of service. After that the money is gone whoever
was at fault, which is what makes an unworked rejection different from a slow one.

| Site | Ever rejected | Recovered | Recovery rate | Still outstanding |
|---|---|---|---|---|
{site_recovery_rows}
Two sites recover about one rejection in twenty. The other four recover about one in four. Same
schemes, same claim types, same software. The difference is whether anybody opens the inbox.

Now split the outstanding money by what it would take to get it:

| Reason | What it would take | Claims | Recovery rate | Outstanding |
|---|---|---|---|---|
{reason_rows}
**{rand(fixable_zar)} is fixable at the practice**: a code, a referral, an authorisation, a
duplicate. That is a clerk and a working week.

**{rand(no_cover_zar)} was never the scheme's to pay.** The member had no cover, the benefit was
exhausted, the service was not on the plan. The scheme is right to refuse it. But the patient
was treated and nobody ever raised an account. That money is not a claims problem at all, and
this is the point most people in the room will miss until you say it.

## Finding 3: the patients who never arrived

{num(ns_count)} booked appointments were no-shows, {pct(ns_pct)} of everything booked, worth
{rand(ns_revenue)} at the {rand(rev_per_visit, 2)} an average visit bills.

| Lead time | Reminder | Bookings | No-show rate | Recoverable | Worth |
|---|---|---|---|---|---|
{ns_rows}
Read it as a grid, not as two lists. A booking made in the next two days with a reminder fails
{pct(no_show[1][3])} of the time. A booking made more than three weeks out with no reminder
fails {pct(no_show[8][3])} of the time. Same practice, same patients.

The recoverable column is deliberately cautious and you should say so. Within each lead band it
takes the no-show rate already observed on the bookings that **did** get a reminder, and applies
it to the ones that did not. It assumes nothing about shortening lead times, which is the larger
effect and the harder change. On that basis: **{num(ns_recoverable)} visits, worth
{rand(ns_recoverable_zar)}**, against an SMS that costs cents.

{pct(unreminded_pct)} of all bookings never got one. Here is who:

| Site | Bookings | Reminders sent | No-show rate | Average lead |
|---|---|---|---|---|
{reminder_rows}

## Finding 4: the same session rate buying very different diaries

Compare within a discipline and never across one. A radiologist and a dietician are bought at
different prices and see patients at different rates, so one league table for all of them says
nothing except which discipline is expensive.

| Discipline | Practitioners | Lowest fill | Median | Highest | Cheapest per visit | Dearest |
|---|---|---|---|---|---|---|
{prac_rows}
| Practitioner | Discipline | Site | Session rate | Fill | Cost per visit | Against peers |
|---|---|---|---|---|---|---|
{prac_worst_rows}
State the caveat before somebody else does: a low fill rate is usually a statement about when
somebody was rostered, not about the clinician. That is why the weekday grid comes first on the
page. This table says where the money goes, the grid says why.

## Finding 5: the gap at reception, and the scheme that pays late

| Charge type | Lines | Billed | Collected | Rate |
|---|---|---|---|---|
{gap_type_rows}
That contrast is the finding and it needs no statistics. A patient with no scheme pays before
they leave, near enough nine times in ten. A patient whose scheme covers most of the bill pays
the small remainder about half the time. Same desk, same card machine, same staff.
{rand(gap[0] - gap[1])} of it is sitting uncollected.

| Scheme | Claims | Claimed | Denial rate | Settles in | Working capital | Gap collected |
|---|---|---|---|---|---|---|
{scheme_rows}
One scheme settles about six weeks later than the rest. At this practice's own claim volume
that one scheme alone ties up {rand(slow_scheme[1])}, and every scheme that runs beyond the
group median adds to {rand(working_capital)} permanently financed by the group.

Say the sentence carefully: that money is **not lost**. It arrives. It just arrives late, and
in the meantime somebody is paying for the overdraft. It is a balance sheet number and it is
never added to the {rand(leak)}.

## The data quality panel, which is part of the pitch

| Defect | Source | Rows | Value touched |
|---|---|---|---|
{quality_rows}
Every one of these is in the source drops and every one survives into the warehouse as a flag
rather than a deletion. Publishing it is the whole argument for doing this properly: a
dashboard that quietly drops the rows it cannot reconcile is how a practice comes to believe a
number that is several per cent short, with no way to find out.

The zero row belongs on the list too. A quality panel that only shows failures cannot tell you
what was checked.

## Questions you will be asked

**Is the no-show recoverable number real?** It is the smallest defensible version. It uses the
behaviour of reminded bookings in the same lead band, on this practice's own data, and claims
nothing about changing anybody's lead time.

**Why not add the empty capacity to the leakage?** Because one is cost incurred and the other is
revenue never received. Adding them produces a number that is wrong in both directions and the
first person in the room who knows the business will say so.

**Could we just cut Monday sessions?** That is the {rand(excess_cost)} line, and it is the blunt
version. The better version is to move them, because the same hours are turning patients away
on a Thursday afternoon. The grid tells you exactly how many and when.

**Where did the data come from?** It is synthetic, generated by `generator/generate.js` from a
fixed seed, and contains no patient identifiers of any kind: no names, no dates of birth, no
identity numbers. Say this before anybody asks, not after.
"""

OUT.write_text(doc, encoding="utf-8")
print(f"wrote {OUT} ({len(doc):,} chars)")
print(f"  headline leakage {rand(leak)} ({pct(leak_pct)}), reconciliation gap {rand(recon_gap, 2)}")
