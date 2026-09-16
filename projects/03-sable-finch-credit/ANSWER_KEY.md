# Sable & Finch Credit demo answer key

Derived from `sable.duckdb` after `dbt build`. Every figure here is what the dashboard will
show, because it reads the same gold models.

Data covers 2024-09-01 to 2026-08-28: 19,880 loans, R602,356,500 disbursed
through 9 branches, R239,515,743 still on the book. All money is South African rand.

**Do not ship this file with the demo.** It is the script for the reveal.

## The headline

| Measure | Value |
|---|---|
| Loans disbursed | 19,880, R602,356,500 |
| Ever 90 days past due | 16.0% |
| Written off | 7.7% |
| Net credit loss | R37,454,692 (6.22% of principal) |
| **Loss above the clean book rate** | **R10,270,077** (27.4% of the loss) |
| Reckless lending exposure, reported separately | R34,848,047 on 3,201 agreements |
| Bridge reconciliation gap | R0.01 |

Do not open on portfolio at risk. That is the number they already have, and it is the reason
they cannot see this. Open on the cohort curves: the same product, written twelve months apart,
performing **42% worse at month six**. Arrears barely move because the book is
growing and new loans dilute the ratio. The curves are not diluted by anything.

## The close

| Driver | Excess loss | Share | Finding |
|---|---|---|---|
| _Loss the clean book would have produced_ | _R27,184,615_ | | |
| Written outside affordability policy | R2,543,444 | 24.8% | 2 |
| The branch that turned | R1,518,417 | 14.8% | 1 |
| Arrears refinanced into a new loan | R2,541,425 | 24.8% | 3 |
| Collection date missing payday | R3,666,791 | 35.7% | 4 |
| **Net credit loss recognised** | **R37,454,692** | | |

Every loan is attributed to exactly one driver, in order of severity, so nothing is counted
twice. A Mahikeng loan that also breaches the affordability floor counts once, against the
floor, because that is the more serious of the two and the one with a legal consequence.

The anchor is the whole book losing at the rate the clean slice of it actually lost at. That
correction matters: anchoring on the clean slice's own loss instead leaves the bridge about
R11m short, because it omits everything the other slices would have lost anyway. The gap above
is R0.01, and it is published so nobody has to take the close on trust.

## The number that is reported beside the close and never added to it

**R34,848,047 outstanding on 3,201 agreements** written below the
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
| 2024-09 | 822 | 6.9% |
| 2024-10 | 859 | 6.9% |
| 2024-11 | 848 | 7.8% |
| 2024-12 | 912 | 9.2% |
| 2025-01 | 541 | 10.5% |
| 2025-02 | 696 | 11.6% |
| 2025-03 | 883 | 8.6% |
| 2025-04 | 807 | 9.7% |
| 2025-05 | 821 | 10.5% |
| 2025-06 | 766 | 10.7% |
| 2025-07 | 837 | 11.6% |
| 2025-08 | 883 | 11.0% |
| 2025-09 | 876 | 11.9% |
| 2025-10 | 911 | 11.2% |
| 2025-11 | 858 | 10.8% |
| 2025-12 | 928 | 10.2% |
| 2026-01 | 615 | 11.7% |
| 2026-02 | 732 | 10.9% |

And what the board actually sees, which is this:

| Month | PAR 30 | PAR 90 | Gross book |
|---|---|---|---|
| 2026-03 | 18.6% | 5.1% | R201,027,967 |
| 2026-04 | 18.1% | 4.9% | R205,242,994 |
| 2026-05 | 17.9% | 4.7% | R207,825,123 |
| 2026-06 | 18.1% | 4.6% | R210,537,796 |
| 2026-07 | 17.8% | 4.2% | R211,634,924 |
| 2026-08 | 18.1% | 4.3% | R212,857,051 |

Point at both. The arrears ratio is flat to mildly rising while the cohort curves have moved
from about 6.9% to about 10.9% at the same age. A growing book hides deterioration
in a ratio, because every new loan lands in the denominator performing.

A cohort is only drawn for the months it has actually been observed. Extending a young cohort
with zeroes to fill the axis is the single most common way a vintage chart lies, and this one
simply stops.

## Finding 2: one branch stopped writing the same business

From May 2025, by branch:

| Branch | Loans | Bad rate vs book | Income inflated | Net loss |
|---|---|---|---|---|
| Mahikeng | 1,017 | 1.62x | 63.7% | R2,971,497 |
| Cape Town Parade | 1,720 | 1.35x | 0.0% | R2,385,825 |
| Pretoria Central | 1,866 | 1.24x | 0.0% | R2,429,595 |
| Pietermaritzburg | 1,031 | 0.93x | 0.0% | R1,581,980 |
| Johannesburg CBD | 2,414 | 0.85x | 0.0% | R3,553,920 |
| Bloemfontein | 1,053 | 0.79x | 0.0% | R1,497,937 |
| Gqeberha Govan Mbeki | 1,280 | 0.79x | 0.0% | R1,915,874 |
| Polokwane | 1,115 | 0.77x | 0.0% | R1,415,185 |
| Durban Point | 2,016 | 0.73x | 0.0% | R3,310,750 |

One branch runs at 1.62x the book bad rate. That on its own is a credit conversation.
The column next to it is not: income declared at origination exceeds the income on file on
**63.7%** of that branch's loans, against **0%** everywhere else.

That is not a credit problem. It is a conduct one, and it is the difference between a
conversation about risk appetite and a conversation with the branch manager.

## Finding 3: loans written with nothing left over

| Affordability band | Loans | Principal | Outstanding | Bad rate | Net loss |
|---|---|---|---|---|---|
| Within policy | 14,647 | R455,294,000 | R188,636,489 | 15.0% | R27,360,173 |
| Breaches floor | 3,511 | R104,365,500 | R34,848,047 | 19.8% | R7,253,505 |
| Under R500 headroom | 1,722 | R42,697,000 | R16,031,207 | 16.7% | R2,841,014 |

3,511 loans were written leaving the client below the regulated expense norm once
the instalment came off. They go bad at 19.8% against 15.0% for
loans inside policy, which is the credit story. The regulatory story is the
R34,848,047 outstanding on them, and it is the one in the separate box above.

## Finding 4: arrears refinanced rather than collected

852 top-ups were written. **849 of them settled an account that
was already delinquent.**

| Measure | Value |
|---|---|
| Top-ups written | 852 |
| Settling a delinquent account | 849 |
| Bad rate on the top-up | 34.5% against 16.0% for the book |
| Average principal multiple | 1.23x the loan it settled |
| Average instalment increase | R596 |
| Net loss on the top-ups | R4,625,597 |

The mechanism is the finding, so describe it rather than the number. A delinquent account is
settled by a larger new loan. The old loan closes as **Settled**, which is true. The new loan
opens as **Current**, which is also true. The arrears clock resets, the client now owes more
on a bigger instalment, and every backward looking report shows an improvement.

Nobody had to intend this for it to happen. It is what a collections target and a sales target
produce when they meet in the same branch.

## Finding 5: debit orders presented on the wrong day

| Collection timing | Loans | First payment default | Bad rate | Net loss |
|---|---|---|---|---|
| Over a week after payday | 2,365 | 17.0% | 22.7% | R6,810,885 |
| 4 to 7 days | 1,885 | 14.9% | 22.5% | R4,514,392 |
| On or next day | 10,374 | 8.4% | 14.2% | R17,756,137 |
| Within 3 days | 5,256 | 8.2% | 13.7% | R8,373,278 |

A debit order presented before the salary lands fails for insufficient funds no matter how
willing the client is. First payment default runs 17.0% where collection is set
more than a week after payday against 8.2% where it is set within a day of it.

This is the cheapest finding on the page and the one to close on if the room is short of time.
It is a field on a form.

## Finding 6: collections effort, against where it works

| Bucket | Activities | Spend | Share of spend | Cure rate | Cost per cure |
|---|---|---|---|---|---|
| 1-30 | 3,976 | R41,012 | 2.45% | 50.42% | **R6** |
| 31-60 | 4,707 | R47,978 | 2.87% | 33.74% | **R24** |
| 61-90 | 5,742 | R727,710 | 43.46% | 20.81% | **R1,076** |
| 90+ | 6,766 | R857,811 | 51.23% | 11.02% | **R2,052** |

A cure costs R6 at one to thirty days and R2,052 past ninety, and
**94.7% of the spend is at the expensive end**. The effort is
almost perfectly inverted against where it works.

Do not say they are wasting the money. Past ninety somebody has to chase it. Say that the
cheapest cure in this business is a phone call in week one, and almost nobody is making it.

## The data quality panel, which is part of the pitch

| Defect | Count | Treatment |
|---|---|---|
| Receipts quoting a loan not in the book | 108 | Kept and flagged, excluded from loan level joins |
| Receipts posted more than once | 704 | Deduplicated on the receipt number |
| Reversals, captured then backed out | 260 | Kept. Netting them away hides a collections control problem |
| Loans that lost their interest rate on migration | 515 | Imputed from the cohort median, flagged |
| Arrears rows disagreeing with the payment history | 2,620 (1.49%) | Reported. Two systems of record, one reconciliation nobody runs |

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
