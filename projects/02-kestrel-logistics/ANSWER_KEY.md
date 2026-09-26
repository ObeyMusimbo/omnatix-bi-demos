# Kestrel Logistics demo answer key

Derived from `kestrel.duckdb` after `dbt build`. Every figure here is what the dashboard will
show, because it reads the same gold models.

Data covers 2024-09-02 to 2026-09-01. TTM means the twelve months to 2026-09-01.
All money is South African rand, excluding VAT.

**Do not ship this file with the demo.** It is the script for the reveal.

## The headline

| Measure | TTM |
|---|---|
| Revenue | R243,339,163 |
| Cost | R215,777,933 |
| Contribution | R27,561,230 (11.3%) |
| Kilometres | 12,435,053 |
| Earned per kilometre | R19.57 |
| Spent per kilometre | R17.35 |
| **Kilometres run empty** | **23.9%** of 12,435,053 km |
| Cost of those empty kilometres | R47,395,784 |

Open on the map, not on a number. Colour the corridors by what they contribute as a round trip
and four of them are red. Then say the line: nearly a quarter of every kilometre this fleet
turns is carrying nothing, and until today nobody was charged for it.

## The close

| Driver | Worth | Share | Finding |
|---|---|---|---|
| _Contribution earned in the last twelve months_ | _R27,561,230_ | | |
| Corridors that fund their own empty return | R5,530,954 | 28.1% | 1 |
| Deliveries that had to be done twice | R6,509,248 | 33.0% | 2 |
| Vehicles burning more than their class | R2,466,906 | 12.5% | 3 |
| Service penalties on the anchor account | R5,213,459 | 26.4% | 4 |
| **Contribution with the same fleet and the same customers** | **R47,281,797** | | |

**R19,720,567 identified against R27,561,230 earned, or 71.6% of
contribution.** Four findings, each worth 13% to 33% of the
total, on the same fleet serving the same customers with nothing new bought. Every step covers
the same twelve months.

Do not promise full recovery. A lane can be repriced or dropped, a receiving problem is a
conversation, an injector is a workshop booking. Half of this inside a year is a serious result
and still lifts contribution by 36%.

## Finding 1: corridors that fund their own empty return

Every lane was priced assuming 60% of the return leg would sell. Nobody revisited it corridor
by corridor. On these lanes the outbound leg looks healthy and the round trip loses money.

| Lane | Backhaul actual | Assumed | Looks like | Actually |
|---|---|---|---|---|
| Johannesburg to Cape Town | 20.0% | 60% | R8,795,537 | **-R1,769,198** |
| Johannesburg to Gqeberha | 14.7% | 60% | R4,449,472 | **-R1,402,551** |
| Durban to Cape Town | 31.2% | 60% | R3,329,389 | **-R519,192** |
| Cape Town to Upington | 22.7% | 60% | R960,848 | **-R319,937** |
| Johannesburg to East London | 27.8% | 60% | R2,169,866 | **-R268,921** |
| Durban to Gqeberha | 39.3% | 60% | R2,262,709 | **-R256,723** |
| Durban to Pietermaritzburg | 74.0% | 60% | R174,564 | **-R247,688** |
| Cape Town to Bloemfontein | 30.2% | 60% | R1,670,736 | **-R237,661** |
| Cape Town to Paarl | 65.6% | 60% | R77,623 | **-R225,569** |
| Durban to Bloemfontein | 42.3% | 60% | R952,530 | **-R213,925** |
| Cape Town to Worcester | 60.1% | 60% | R276,683 | **-R40,791** |
| Johannesburg to Rustenburg | 64.4% | 60% | R397,365 | **-R28,799** |

The whole reveal is one join: pair an outbound trip with the return it caused, and charge the
cost of both legs against the revenue they jointly earned. Kestrel's reporting measures legs,
so the empty return has never been charged to anything.

Say this out loud: the Johannesburg to Cape Town corridor is their biggest single lane by
revenue and it is their worst by contribution. Nobody running it is doing anything wrong. The
rate card is.

## Finding 2: deliveries that had to be done twice

3,334 drops failed on first attempt in the last twelve months, 4.0% of
everything delivered, costing **R6,509,248** in journeys that earned nothing.

| Site | Failure rate | Failed drops | Cost | Usual reason |
|---|---|---|---|---|
| Atlantis Industries | 27.1% | 221 | R680,539 | No booked slot |
| Midrand Supplies 3 | 33.2% | 127 | R256,910 | No booked slot |
| Midrand Holdings | 31.6% | 158 | R232,605 | No booked slot |
| Karoo Supplies | 35.1% | 158 | R226,970 | No booked slot |
| Springfield Manufacturing | 23.1% | 78 | R141,149 | Receiving closed |
| Montague Wholesalers | 25.5% | 63 | R127,408 | No booked slot |

These sites are not having bad luck. They have no booked receiving slot, or a goods-in desk
with one person on it. This is a conversation with six customers, not an analysis.

It is invisible in a revenue report by definition: a failed delivery has no revenue to report.

## Finding 3: seven vehicles burning more than their class

Compared against the median of their own class on the same lanes and loads, not against the
fleet, because consumption only means anything against like work.

| Registration | Class | L/100km | Class median | Excess | Cost |
|---|---|---|---|---|---|
| CA219803 | Superlink 34t | 58.33 | 45.8 | +27.3% | R540,038 |
| GP837939 | Superlink 34t | 58.41 | 45.8 | +27.5% | R471,170 |
| GP153377 | Superlink 34t | 55.96 | 45.8 | +22.1% | R428,702 |
| ND548557 | Superlink 34t | 57.48 | 45.8 | +25.4% | R291,074 |
| GP993548 | Tri-axle 24t | 44.26 | 37.4 | +18.4% | R284,680 |
| CA591856 | Tri-axle 24t | 48.69 | 37.4 | +30.2% | R258,592 |
| ND132999 | Tri-axle 24t | 45.5 | 37.4 | +21.7% | R192,651 |

The dashboard cannot say whether this is injectors, dragging brakes, or diesel walking off the
forecourt. It can say these seven are worth the price of a workshop booking to find out.

## Finding 4: Friday, and the last two days of the month

| Dispatch day | On time | Drops |
|---|---|---|
| Month end run | 65.2% | 8,030 |
| Friday | 74.1% | 13,279 |
| Normal day | 95.8% | 61,792 |

Dispatch batches whatever is still standing into one run, trucks leave hours late, and every
drop on the route is late together.

The part that matters commercially is who it lands on:

| Contract | Dispatch day | On time |
|---|---|---|
| Contract | Friday | 56.8% |
| Contract | Month end run | 46.5% |
| Contract | Normal day | 96.2% |
| Dedicated | Friday | 19.2% |
| Dedicated | Month end run | 15.0% |
| Dedicated | Normal day | 96.1% |
| Spot | Friday | 94.8% |
| Spot | Month end run | 86.7% |
| Spot | Normal day | 95.5% |

Dedicated accounts book a two hour window, Contract four, Spot eight. So the customers paying
most for service are the ones failed first, and the ones on the loosest terms barely notice.

Penalty exposure on the anchor account, at 2% of monthly spend per point below 90%:
**R5,213,459**.

## Finding 5: paying to move air

| Class | Air trips | Weight used | Volume used | Cost |
|---|---|---|---|---|
| Superlink 34t | 1,843 | 69.1% | 82.6% | R28,575,280 |
| Tri-axle 24t | 1,855 | 68.7% | 82.2% | R13,346,010 |
| Rigid 14t | 112 | 76.5% | 74.9% | R427,084 |
| Rigid 8t | 63 | 76.3% | 75.3% | R206,668 |
| LDV 1.5t | 48 | 65.5% | 70.4% | R110,567 |

Freight is billed by weight, but a trailer runs out of deck space long before it runs out of
axle allowance on light, bulky cargo. These trips are full and the invoice is small.

Not money on the table today in the way the other four are. It is the case for consolidating
loads onto fewer, fuller trucks, and it is the one finding that needs an operations change
rather than a phone call.

## Data quality resolved in the silver layer

Walk a technical buyer through these. It is the difference between a dashboard and a platform.

1. Timestamps in two formats from two systems, 28% of trips on the older dispatch export
2. Vehicle registrations captured three ways, so one truck looked like three
3. 303 double-swiped fuel cards, which had to be cast before deduplicating because the copies
   differ in how the litres were written
4. 120 odometer readings with a digit dropped on capture, flagged rather than guessed at
5. Customer names with stray whitespace and an inconsistent Pty Ltd suffix
6. 3,231 drops with no weight captured, estimated from volume at the median density
7. 40 trips with a GPS distance of zero or less, falling back to the lane nominal
8. 90 drops quoting a trip absent from the trip file, kept and flagged, covered by a
   deliberately warning test rather than dropped
9. Three delivery statuses written six ways
10. 4,611 fuel rows with a decimal comma, from a provider exporting on European locale settings
