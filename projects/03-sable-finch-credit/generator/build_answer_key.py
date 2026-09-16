"""
Write ANSWER_KEY.md from the built warehouse.

Derived from gold, never recomputed alongside it, so the reveal script and the dashboard
cannot drift apart. That rule exists because the first version of the Meridian answer key was
computed independently, disagreed with the page by about R2m, and the page was right.

Run after `dbt build`:
    ../../.venv/Scripts/python.exe generator/build_answer_key.py
"""

from pathlib import Path
import duckdb

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
DB = PROJECT / "sable.duckdb"
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


# ---------------------------------------------------------------- scale

period_from, period_through = one(
    "select min(disbursement_date), max(disbursement_date) from main_gold.dim_loan")

scale = one("""
    select count(*), round(sum(principal_zar)), round(sum(current_balance_zar)),
           (select count(*) from main_gold.dim_branch),
           round(100.0 * count(*) filter (where ever_90) / count(*), 1),
           round(100.0 * count(*) filter (where status = 'Written off') / count(*), 1)
    from main_gold.dim_loan
""")
loans, disbursed, book, branches, ever90_pct, writeoff_pct = scale

close = one("""
    select any_value(total_loss_zar), any_value(total_excess_zar), any_value(excess_pct_of_loss),
           any_value(total_principal_zar), any_value(loss_rate_pct),
           any_value(reckless_loans), any_value(reckless_exposure_zar)
    from main_gold.mart_exposure_bridge
""")
total_loss, total_excess, excess_pct, principal, loss_rate, reckless_loans, reckless_zar = close

bridge = rows("""
    select step_order, driver, driver_short, step_type, effect_zar, pct_of_excess, finding_ref
    from main_gold.mart_exposure_bridge order by step_order
""")

# The bridge must close on its own arithmetic. Reported rather than trusted.
bridge_gap = one("""
    select round(
        (select effect_zar from main_gold.mart_exposure_bridge where step_type = 'anchor')
      + (select coalesce(sum(effect_zar), 0) from main_gold.mart_exposure_bridge where step_type = 'increase')
      - (select effect_zar from main_gold.mart_exposure_bridge where step_type = 'total'), 2)
""")[0]

# ---------------------------------------------------------------- finding 1, the curves

vintage = rows("""
    select cohort_label, sum(cohort_loans),
           round(100.0 * sum(bad_loans) / sum(cohort_loans), 1)
    from main_gold.mart_vintage
    where months_on_book = 6
    group by cohort_month, cohort_label
    order by cohort_month
""")
par = rows("""
    select year_month, round(par30_pct, 1), round(par90_pct, 1), round(gross_book_zar)
    from main_gold.agg_book_monthly order by month_start_date
""")

# ---------------------------------------------------------------- finding 2, the branch

branch = rows("""
    select branch_name, sum(loans), round(avg(bad_rate_vs_book_x), 2),
           round(avg(income_inflated_pct), 1), round(sum(net_loss_zar))
    from main_gold.mart_branch_risk
    where cohort_month >= date '2025-05-01'
    group by 1 order by 3 desc
""")

# ---------------------------------------------------------------- finding 3, affordability

afford = rows("""
    select affordability_band, sum(loans), round(sum(principal_zar)), round(sum(outstanding_zar)),
           round(100.0 * sum(loans_ever_90) / sum(loans), 1), round(sum(net_loss_zar))
    from main_gold.mart_affordability
    group by 1 order by 3 desc
""")

# ---------------------------------------------------------------- finding 4, top-ups

topup = one("""
    select count(*), count(*) filter (where settled_account_was_delinquent),
           round(100.0 * count(*) filter (where topup_ever_90) / count(*), 1),
           round(avg(principal_multiple), 2), round(sum(topup_net_loss_zar)),
           round(avg(instalment_increase_zar))
    from main_gold.mart_topup_masking
""")
topups, topup_delinquent, topup_bad_pct, topup_multiple, topup_loss, topup_instalment = topup
book_bad_pct = one("select round(100.0 * count(*) filter (where ever_90) / count(*), 1) from main_gold.dim_loan")[0]

# ---------------------------------------------------------------- finding 5, debit orders

debit = rows("""
    select timing_band, sum(loans), round(avg(first_payment_default_pct), 1),
           round(avg(bad_rate_pct), 1), round(sum(net_loss_zar))
    from main_gold.mart_debit_order
    group by 1 order by 3 desc
""")

# ---------------------------------------------------------------- finding 6, collections

coll = rows("""
    select arrears_bucket, activities, round(cost_zar), share_of_spend_pct,
           cure_rate_pct, round(cost_per_cure_zar)
    from main_gold.mart_collections
    order by array_position(['Current', '1-30', '31-60', '61-90', '90+'], arrears_bucket)
""")

# ---------------------------------------------------------------- data quality

quality = one("""
    select
      (select count(*) from main_silver.sl_repayments where not loan_is_known) as orphan_receipts,
      (select count(*) from main_silver.sl_repayments where was_posted_twice) as double_posted,
      (select count(*) from main_silver.sl_repayments where is_reversal) as reversals,
      (select count(*) from main_silver.sl_loans where rate_is_imputed) as rate_imputed,
      (select count(*) from main_silver.sl_arrears_snapshots where conflicts_with_payment_history) as conflicts,
      (select round(100.0 * count(*) filter (where conflicts_with_payment_history) / count(*), 2)
         from main_silver.sl_arrears_snapshots) as conflict_pct
""")
orphans, double_posted, reversals, rate_imputed, conflicts, conflict_pct = quality

# ---------------------------------------------------------------- render

bridge_rows = ""
for _, driver, _short, step_type, effect, share, ref in bridge:
    if step_type == "anchor":
        bridge_rows += f"| _{driver}_ | _{rand(effect)}_ | | |\n"
    elif step_type == "total":
        bridge_rows += f"| **{driver}** | **{rand(effect)}** | | |\n"
    else:
        bridge_rows += f"| {driver} | {rand(effect)} | {pct(share)} | {ref or ''} |\n"

vintage_rows = "".join(f"| {c} | {num(n)} | {pct(b)} |\n" for c, n, b in vintage)
par_rows = "".join(f"| {m} | {pct(a)} | {pct(b)} | {rand(g)} |\n" for m, a, b, g in par[-6:])
branch_rows = "".join(
    f"| {n} | {num(l)} | {m}x | {pct(i)} | {rand(x)} |\n" for n, l, m, i, x in branch)
afford_rows = "".join(
    f"| {b} | {num(l)} | {rand(p)} | {rand(o)} | {pct(bad)} | {rand(x)} |\n"
    for b, l, p, o, bad, x in afford)
debit_rows = "".join(
    f"| {b} | {num(l)} | {pct(f)} | {pct(bad)} | {rand(x)} |\n" for b, l, f, bad, x in debit)
coll_rows = "".join(
    f"| {b} | {num(a)} | {rand(c)} | {pct(s, 2)} | {pct(cu, 2)} | **{rand(pc)}** |\n"
    for b, a, c, s, cu, pc in coll)

early = [v[2] for v in vintage[:4]]
late = [v[2] for v in vintage[-4:] if v[2] is not None]
worse_pct = (sum(late) / len(late)) / (sum(early) / len(early)) * 100 - 100

doc = f"""# Sable & Finch Credit demo answer key

Derived from `sable.duckdb` after `dbt build`. Every figure here is what the dashboard will
show, because it reads the same gold models.

Data covers {period_from} to {period_through}: {num(loans)} loans, {rand(disbursed)} disbursed
through {branches} branches, {rand(book)} still on the book. All money is South African rand.

**Do not ship this file with the demo.** It is the script for the reveal.

## The headline

| Measure | Value |
|---|---|
| Loans disbursed | {num(loans)}, {rand(disbursed)} |
| Ever 90 days past due | {pct(ever90_pct)} |
| Written off | {pct(writeoff_pct)} |
| Net credit loss | {rand(total_loss)} ({pct(loss_rate, 2)} of principal) |
| **Loss above the clean book rate** | **{rand(total_excess)}** ({pct(excess_pct)} of the loss) |
| Reckless lending exposure, reported separately | {rand(reckless_zar)} on {num(reckless_loans)} agreements |
| Bridge reconciliation gap | {rand(bridge_gap, 2)} |

Do not open on portfolio at risk. That is the number they already have, and it is the reason
they cannot see this. Open on the cohort curves: the same product, written twelve months apart,
performing **{worse_pct:.0f}% worse at month six**. Arrears barely move because the book is
growing and new loans dilute the ratio. The curves are not diluted by anything.

## The close

| Driver | Excess loss | Share | Finding |
|---|---|---|---|
{bridge_rows}
Every loan is attributed to exactly one driver, in order of severity, so nothing is counted
twice. A Mahikeng loan that also breaches the affordability floor counts once, against the
floor, because that is the more serious of the two and the one with a legal consequence.

The anchor is the whole book losing at the rate the clean slice of it actually lost at. That
correction matters: anchoring on the clean slice's own loss instead leaves the bridge about
R11m short, because it omits everything the other slices would have lost anyway. The gap above
is {rand(bridge_gap, 2)}, and it is published so nobody has to take the close on trust.

## The number that is reported beside the close and never added to it

**{rand(reckless_zar)} outstanding on {num(reckless_loans)} agreements** written below the
affordability floor. Say this slowly, because the distinction is the whole point:

That is not an expected credit loss. It is the balance on agreements a court could set aside
under section 83 of the National Credit Act, having found the credit reckless under section 81.
Treating it as a credit number understates it, because the exposure is the whole balance rather
than the expected loss on it. Adding it to a credit number overstates that. So it sits next to
the bridge, in its own box, permanently.

## Finding 1: the curves the arrears report cannot show

Cumulative bad rate at month six, by disbursement cohort:

| Cohort | Loans | Bad at month 6 |
|---|---|---|
{vintage_rows}
And what the board actually sees, which is this:

| Month | PAR 30 | PAR 90 | Gross book |
|---|---|---|---|
{par_rows}
Point at both. The arrears ratio is flat to mildly rising while the cohort curves have moved
from about {early[0]}% to about {late[-1]}% at the same age. A growing book hides deterioration
in a ratio, because every new loan lands in the denominator performing.

A cohort is only drawn for the months it has actually been observed. Extending a young cohort
with zeroes to fill the axis is the single most common way a vintage chart lies, and this one
simply stops.

## Finding 2: one branch stopped writing the same business

From May 2025, by branch:

| Branch | Loans | Bad rate vs book | Income inflated | Net loss |
|---|---|---|---|---|
{branch_rows}
One branch runs at {branch[0][2]}x the book bad rate. That on its own is a credit conversation.
The column next to it is not: income declared at origination exceeds the income on file on
**{pct(branch[0][3])}** of that branch's loans, against **0%** everywhere else.

That is not a credit problem. It is a conduct one, and it is the difference between a
conversation about risk appetite and a conversation with the branch manager.

## Finding 3: loans written with nothing left over

| Affordability band | Loans | Principal | Outstanding | Bad rate | Net loss |
|---|---|---|---|---|---|
{afford_rows}
{num(afford[1][1])} loans were written leaving the client below the regulated expense norm once
the instalment came off. They go bad at {pct(afford[1][4])} against {pct(afford[0][4])} for
loans inside policy, which is the credit story. The regulatory story is the
{rand(afford[1][3])} outstanding on them, and it is the one in the separate box above.

## Finding 4: arrears refinanced rather than collected

{num(topups)} top-ups were written. **{num(topup_delinquent)} of them settled an account that
was already delinquent.**

| Measure | Value |
|---|---|
| Top-ups written | {num(topups)} |
| Settling a delinquent account | {num(topup_delinquent)} |
| Bad rate on the top-up | {pct(topup_bad_pct)} against {pct(book_bad_pct)} for the book |
| Average principal multiple | {topup_multiple}x the loan it settled |
| Average instalment increase | {rand(topup_instalment)} |
| Net loss on the top-ups | {rand(topup_loss)} |

The mechanism is the finding, so describe it rather than the number. A delinquent account is
settled by a larger new loan. The old loan closes as **Settled**, which is true. The new loan
opens as **Current**, which is also true. The arrears clock resets, the client now owes more
on a bigger instalment, and every backward looking report shows an improvement.

Nobody had to intend this for it to happen. It is what a collections target and a sales target
produce when they meet in the same branch.

## Finding 5: debit orders presented on the wrong day

| Collection timing | Loans | First payment default | Bad rate | Net loss |
|---|---|---|---|---|
{debit_rows}
A debit order presented before the salary lands fails for insufficient funds no matter how
willing the client is. First payment default runs {pct(debit[0][2])} where collection is set
more than a week after payday against {pct(debit[-1][2])} where it is set within a day of it.

This is the cheapest finding on the page and the one to close on if the room is short of time.
It is a field on a form.

## Finding 6: collections effort, against where it works

| Bucket | Activities | Spend | Share of spend | Cure rate | Cost per cure |
|---|---|---|---|---|---|
{coll_rows}
A cure costs {rand(coll[0][5])} at one to thirty days and {rand(coll[-1][5])} past ninety, and
**{pct(coll[-1][3] + coll[-2][3], 1)} of the spend is at the expensive end**. The effort is
almost perfectly inverted against where it works.

Do not say they are wasting the money. Past ninety somebody has to chase it. Say that the
cheapest cure in this business is a phone call in week one, and almost nobody is making it.

## The data quality panel, which is part of the pitch

| Defect | Count | Treatment |
|---|---|---|
| Receipts quoting a loan not in the book | {num(orphans)} | Kept and flagged, excluded from loan level joins |
| Receipts posted more than once | {num(double_posted)} | Deduplicated on the receipt number |
| Reversals, captured then backed out | {num(reversals)} | Kept. Netting them away hides a collections control problem |
| Loans that lost their interest rate on migration | {num(rate_imputed)} | Imputed from the cohort median, flagged |
| Arrears rows disagreeing with the payment history | {num(conflicts)} ({pct(conflict_pct, 2)}) | Reported. Two systems of record, one reconciliation nobody runs |

The deduplication is worth a sentence out loud, because it is the kind of thing that decides
whether a number is right. Most double posts are byte-identical once cast, and deduplicating on
every column removes them. A handful are not: the same receipt number appears against two
different loan references because the copy was re-keyed against the wrong account. Deduplicate
on the whole row and both survive, the grain breaks, and the receipt is counted twice. This
pipeline deduplicates on the receipt number, prefers the row naming a loan that exists, and a
unique test proves it on every build. That test is what found it.

## Questions you will be asked

**Is the loss number the write-off number?** No. Net loss is written off less recovered, so a
loan that was written off and partly recovered contributes the difference.

**Why is reckless exposure not in the total?** Because it is a balance at legal risk, not an
expected loss. They are different quantities and a single number made of both is wrong in
both directions.

**How early could we have seen the branch?** The income inflation is visible at origination,
before a single instalment falls due. That is the argument for the whole engagement.

**Where did the data come from?** It is synthetic, generated by `generator/generate.js` from a
fixed seed. There are no identity numbers anywhere in it, by design: a borrower is a reference,
an age band, an employer sector and an income. Say this before anybody asks, not after.
"""

OUT.write_text(doc, encoding="utf-8")
print(f"wrote {OUT} ({len(doc):,} chars)")
print(f"  net loss {rand(total_loss)}, excess {rand(total_excess)} ({pct(excess_pct)}), "
      f"bridge gap {rand(bridge_gap, 2)}")
