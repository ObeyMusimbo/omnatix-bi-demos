# Lumen Health Network demo answer key

Derived from `lumen.duckdb` after `dbt build`. Every figure here is what the dashboard will
show, because it reads the same gold models.

Data covers 2024-09-02 to 2026-08-31, 6 sites, 32 practitioners,
39,976 patients and 232,558 booked appointments. All money is South African rand,
excluding VAT.

**Do not ship this file with the demo.** It is the script for the reveal.

## The headline

| Measure | Over the window |
|---|---|
| Billed for care delivered | R160,784,568 |
| Cash received for it | R143,367,133 |
| **Never collected** | **R17,417,435** (10.8% of everything billed) |
| Owed by schemes and never recovered | R11,041,079 |
| Owed by patients and never collected | R6,359,303 |
| Bridge reconciliation gap | R0.00 |

Open on the sentence, not the number. This practice saw 187,464 patients, billed for
every one of them, and collected on nine rands in ten. Nobody stole anything and nobody was
negligent. It leaked out through a claims inbox nobody opens and a card machine nobody reaches
for.

The reconciliation gap is zero and that is deliberate. Say so. Every rand of the shortfall
lands in exactly one bucket, and the buckets are defined by who has to do something about it.

## The close

| Step | Effect | Finding |
|---|---|---|
| _Billed for care delivered_ | _R160,784,568_ | |
| Rejected for something the practice can fix, and never reworked | -R6,332,260 | 2 |
| Rejected because there was no cover, and never billed to the patient | -R4,708,819 | 2 |
| Gap and self funded charges left uncollected at reception | -R6,359,303 | 5 |
| Refunds and credit notes | -R17,054 |  |
| **Cash received for care delivered** | **R143,367,133** | |

Three actions, and they belong to three different people. The billing clerk works the
rejections. The receptionist asks for the gap before the patient stands up. The practice
manager raises an account when the scheme says there was no cover.

Do not promise full recovery. A four month claim deadline that has already passed is gone, and
some of the gap was never going to be collected. Half of this inside a year is a serious
result and it costs nothing but a process.

## The second number, and never add it to the first

| Measure | Over the window |
|---|---|
| Consulting slots offered | 354,570 |
| Slots booked | 232,558 (65.6%) |
| Never booked | 122,012 |
| Booked and not arrived | 36,922 |
| **Chairs with nobody in them** | **44.8%** |
| Clinician cost of the whole roster | R69,219,700 |
| Cost of slots never booked | R23,911,841 |
| Cost of slots booked and not arrived | R7,191,112 |
| Capacity above a diary running at 85% | 83,091 slots, R16,322,601 |

This is a cost that was incurred, not revenue that was foregone, so it never gets added to the
R17,417,435. If anybody in the room adds them, stop them: one of those numbers is money that
left the bank and the other is money that never arrived.

The excess figure is the conservative one and it is worth explaining. It does not assume a
single patient moves. It asks, cell by cell, how much capacity a diary at 85%
would need to serve the demand that already falls in that cell, and counts anything above it.

## Finding 1: the week is lopsided, and the roster is not

The roster is almost identical Monday to Friday. The demand is nothing like it.

| Weekday | Slots offered | Booked | Fill | Cost of the empty ones |
|---|---|---|---|---|
| Monday | 68,265 | 27,646 | 40.5% | R7,986,142 |
| Tuesday | 67,644 | 44,885 | 66.4% | R4,448,891 |
| Wednesday | 68,895 | 48,885 | 71.0% | R3,914,486 |
| Thursday | 67,914 | 52,435 | 77.2% | R3,038,151 |
| Friday | 67,836 | 53,318 | 78.6% | R2,838,393 |
| Saturday | 14,016 | 5,389 | 38.4% | R1,685,842 |

The five emptiest hours in the working week:

| Cell | Slots | Fill | Average wait |
|---|---|---|---|
| Monday 08:00 | 7,777 | 16.9% | 6.8 min |
| Monday 09:00 | 7,489 | 22.5% | 6.6 min |
| Monday 10:00 | 7,682 | 27.1% | 7.0 min |
| Monday 11:00 | 7,584 | 29.8% | 6.8 min |
| Monday 13:00 | 7,682 | 41.9% | 8.2 min |

And the five fullest:

| Cell | Slots | Fill | Average wait |
|---|---|---|---|
| Friday 16:00 | 7,267 | 91.9% | 32.8 min |
| Thursday 16:00 | 7,259 | 90.2% | 32.4 min |
| Friday 15:00 | 7,625 | 90.1% | 31.6 min |
| Thursday 15:00 | 7,643 | 89.4% | 31.5 min |
| Friday 14:00 | 7,541 | 86.7% | 29.9 min |

That is the whole finding in two tables. The same practice, the same clinicians, the same
rooms. On a Monday morning the rooms are 16.9% full. On a Friday afternoon
they are 91.9% full and the patients who get in wait 32.8 minutes.

The link to finding 3, and state it in this order. How full a cell is and how far ahead it gets
booked move together almost exactly: the correlation across the working week is
0.98. The quietest hours are taken about 11.7 days ahead, the busiest
about 18.3. The busy cells are booked further out because they are the only ones
left, and finding 3 shows that bookings made further out are the ones that do not arrive.

The relationship is tight, the size of it is modest, and both halves of that sentence matter.
Six extra days of lead time costs roughly three no-shows in every hundred. Claim that, not
more. The diary imbalance is not the main cause of the no-show rate. It is a contributor that
runs in the direction that costs money, on top of a reminder problem that is much larger.

## Finding 2: rejected claims that nobody worked

21,397 claims came back rejected or short paid, 12.4% of everything
submitted. R3,281,478 was recovered by resubmitting. **R11,041,079 was
not.**

The scheme allows four months from the date of service. After that the money is gone whoever
was at fault, which is what makes an unworked rejection different from a slow one.

| Site | Ever rejected | Recovered | Recovery rate | Still outstanding |
|---|---|---|---|---|
| Lumen Summerstrand | 3,344 | 159 | 4.8% | R1,980,071 |
| Lumen Westdene | 1,966 | 101 | 5.1% | R1,227,918 |
| Lumen Sandton | 3,905 | 891 | 22.8% | R1,973,142 |
| Lumen Brooklyn | 3,781 | 913 | 24.1% | R2,124,794 |
| Lumen Umhlanga | 3,619 | 884 | 24.4% | R1,863,035 |
| Lumen Claremont | 4,782 | 1,170 | 24.5% | R1,872,117 |

Two sites recover about one rejection in twenty. The other four recover about one in four. Same
schemes, same claim types, same software. The difference is whether anybody opens the inbox.

Now split the outstanding money by what it would take to get it:

| Reason | What it would take | Claims | Recovery rate | Outstanding |
|---|---|---|---|---|
| Incorrect ICD-10 code | Fixable at the practice | 4,753 | 28.2% | R2,172,017 |
| Benefit exhausted | No cover, becomes a patient account | 3,188 | 0.0% | R2,069,576 |
| Membership lapsed at date of service | No cover, becomes a patient account | 3,009 | 0.0% | R1,952,004 |
| Missing referral | Fixable at the practice | 4,225 | 29.6% | R1,869,321 |
| Authorisation not obtained | Fixable at the practice | 3,687 | 30.0% | R1,636,688 |
| Service not covered on plan | No cover, becomes a patient account | 1,084 | 0.0% | R687,238 |
| Practice number incorrect | Fixable at the practice | 1,451 | 29.1% | R654,234 |

**R6,332,260 is fixable at the practice**: a code, a referral, an authorisation, a
duplicate. That is a clerk and a working week.

**R4,708,819 was never the scheme's to pay.** The member had no cover, the benefit was
exhausted, the service was not on the plan. The scheme is right to refuse it. But the patient
was treated and nobody ever raised an account. That money is not a claims problem at all, and
this is the point most people in the room will miss until you say it.

## Finding 3: the patients who never arrived

36,922 booked appointments were no-shows, 15.9% of everything booked, worth
R31,667,349 at the R857.68 an average visit bills.

| Lead time | Reminder | Bookings | No-show rate | Recoverable | Worth |
|---|---|---|---|---|---|
| 0 to 2 days | no | 10,990 | 9.6% | 443 | R380,109 |
| 0 to 2 days | yes | 27,870 | 5.6% |  |  |
| 3 to 6 days | no | 14,614 | 9.6% | 586 | R502,386 |
| 3 to 6 days | yes | 37,038 | 5.6% |  |  |
| 1 to 2 weeks | no | 24,484 | 18.4% | 2,030 | R1,741,367 |
| 1 to 2 weeks | yes | 14,198 | 10.2% |  |  |
| 2 to 3 weeks | no | 24,648 | 18.5% | 1,949 | R1,671,322 |
| 2 to 3 weeks | yes | 14,428 | 10.6% |  |  |
| Over 3 weeks | no | 40,577 | 34.7% | 6,069 | R5,205,082 |
| Over 3 weeks | yes | 23,711 | 19.8% |  |  |

Read it as a grid, not as two lists. A booking made in the next two days with a reminder fails
5.6% of the time. A booking made more than three weeks out with no reminder
fails 34.7% of the time. Same practice, same patients.

The recoverable column is deliberately cautious and you should say so. Within each lead band it
takes the no-show rate already observed on the bookings that **did** get a reminder, and applies
it to the ones that did not. It assumes nothing about shortening lead times, which is the larger
effect and the harder change. On that basis: **11,077 visits, worth
R9,500,266**, against an SMS that costs cents.

49.6% of all bookings never got one. Here is who:

| Site | Bookings | Reminders sent | No-show rate | Average lead |
|---|---|---|---|---|
| Lumen Summerstrand | 36,732 | 28.9% | 17.7% | 19.2 days |
| Lumen Westdene | 21,173 | 35.1% | 16.6% | 17.8 days |
| Lumen Umhlanga | 40,189 | 43.0% | 16.9% | 19.2 days |
| Lumen Claremont | 52,103 | 59.0% | 15.7% | 18.8 days |
| Lumen Brooklyn | 39,604 | 59.3% | 14.9% | 17.2 days |
| Lumen Sandton | 42,757 | 64.8% | 14.1% | 17.1 days |


## Finding 4: the same session rate buying very different diaries

Compare within a discipline and never across one. A radiologist and a dietician are bought at
different prices and see patients at different rates, so one league table for all of them says
nothing except which discipline is expensive.

| Discipline | Practitioners | Lowest fill | Median | Highest | Cheapest per visit | Dearest |
|---|---|---|---|---|---|---|
| General practice | 16 | 41.3% | 68.9% | 91.7% | R180 | R451 |
| Dentistry | 6 | 38.1% | 70.6% | 89.2% | R381 | R1,058 |
| Physiotherapy | 3 | 52.1% | 64.4% | 86.7% | R265 | R403 |
| Dietetics | 3 | 31.0% | 55.1% | 80.4% | R243 | R709 |

| Practitioner | Discipline | Site | Session rate | Fill | Cost per visit | Against peers |
|---|---|---|---|---|---|---|
| Dr Sizwe Maseko | Dentistry | Lumen Sandton | R5,987 | 38.1% | R1,058 | 2.04x |
| Dr Naledi Molefe | Dietetics | Lumen Westdene | R3,256 | 31.0% | R709 | 1.96x |
| Dr Nomsa Sithole | Dentistry | Lumen Brooklyn | R5,602 | 39.5% | R948 | 1.83x |
| Dr Riaan Maseko | General practice | Lumen Sandton | R4,234 | 41.3% | R451 | 1.63x |
| Dr Naledi Jacobs | General practice | Lumen Claremont | R4,199 | 44.4% | R423 | 1.52x |

State the caveat before somebody else does: a low fill rate is usually a statement about when
somebody was rostered, not about the clinician. That is why the weekday grid comes first on the
page. This table says where the money goes, the grid says why.

## Finding 5: the gap at reception, and the scheme that pays late

| Charge type | Lines | Billed | Collected | Rate |
|---|---|---|---|---|
| Self funded | 14,696 | R12,565,059 | R11,227,924 | 89.4% |
| Scheme gap | 172,768 | R10,088,717 | R5,066,548 | 50.2% |
| Refund | 180 | R0 | -R17,054 | n/a |

That contrast is the finding and it needs no statistics. A patient with no scheme pays before
they leave, near enough nine times in ten. A patient whose scheme covers most of the bill pays
the small remainder about half the time. Same desk, same card machine, same staff.
R6,374,296 of it is sitting uncollected.

| Scheme | Claims | Claimed | Denial rate | Settles in | Working capital | Gap collected |
|---|---|---|---|---|---|---|
| Aurum Health | 56,471 | R45,527,288 | 9.9% | 33.8 days | R0 | 50.3% |
| Veritas Medical | 36,040 | R29,959,148 | 9.9% | 30.7 days | R0 | 50.1% |
| Koppie Health | 26,528 | R20,006,827 | 10.1% | 75.8 days | R1,107,186 | 49.9% |
| Ndlela Scheme | 22,275 | R17,662,377 | 10.2% | 36.8 days | R36,915 | 50.5% |
| Stellar Med | 16,392 | R13,387,930 | 10.3% | 32.6 days | R0 | 49.8% |
| Public Service Med | 15,062 | R11,587,223 | 9.9% | 45.6 days | R162,655 | 50.3% |

One scheme settles about six weeks later than the rest. At this practice's own claim volume
that one scheme alone ties up R1,107,186, and every scheme that runs beyond the
group median adds to R1,306,756 permanently financed by the group.

Say the sentence carefully: that money is **not lost**. It arrives. It just arrives late, and
in the meantime somebody is paying for the overdraft. It is a balance sheet number and it is
never added to the R17,417,435.

## The data quality panel, which is part of the pitch

| Defect | Source | Rows | Value touched |
|---|---|---|---|
| Diagnosis code missing on the encounter | Encounters | 5,048 | R3,224,037 |
| Payment quotes an appointment that does not exist | Patient payments | 95 | R7,956 |
| Claim submitted more than once by the switch | Claims | 863 | R679,392 |
| Dates exported as DD/MM/YYYY instead of ISO | Claims and sessions | 45,448 | R36,256,017 |
| Site name captured in more than one spelling | Clinics | 1 | R0 |
| Appointment status captured in mixed case | Appointments | 27,974 | R0 |
| Appointment status that did not map to a known state | Appointments | 0 | R0 |

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

**Could we just cut Monday sessions?** That is the R16,322,601 line, and it is the blunt
version. The better version is to move them, because the same hours are turning patients away
on a Thursday afternoon. The grid tells you exactly how many and when.

**Where did the data come from?** It is synthetic, generated by `generator/generate.js` from a
fixed seed, and contains no patient identifiers of any kind: no names, no dates of birth, no
identity numbers. Say this before anybody asks, not after.
