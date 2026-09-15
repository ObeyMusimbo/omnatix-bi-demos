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
| Cost | R215,770,826 |
| Contribution | R27,568,337 (11.3%) |
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
| _Contribution earned in the last twelve months_ | _R27,568,337_ | | |
| Corridors that fund their own empty return | R5,525,148 | 25.2% | 1 |
| Deliveries that had to be done twice | R6,509,247 | 29.7% | 2 |
| Vehicles burning more than their class | R4,663,684 | 21.3% | 3 |
| Service penalties on the anchor account | R5,213,459 | 23.8% | 4 |
| **Contribution with the same fleet and the same customers** | **R49,479,875** | | |

**R21,911,538 identified against R27,568,337 earned, or 79.5% of
contribution.** Four findings, each worth a fifth to a third of the total, on the same fleet
serving the same customers with nothing new bought.

Do not promise full recovery. A lane can be repriced or dropped, a receiving problem is a
conversation, an injector is a workshop booking. Half of this inside a year is a serious result
and still doubles their margin.

## Finding 1: corridors that fund their own empty return

Every lane was priced assuming 60% of the return leg would sell. Nobody revisited it corridor
by corridor. On these lanes the outbound leg looks healthy and the round trip loses money.

| Lane | Backhaul actual | Assumed | Looks like | Actually |
|---|---|---|---|---|
| Johannesburg to Cape Town | 20.0% | 60% | R8,795,537 | **-R1,769,198** |
| Johannesburg to Gqeberha | 14.7% | 60% | R4,449,472 | **-R1,402,551** |
| Durban to Cape Town | 31.2% | 60% | R3,329,389 | **-R519,192** |
| Cape Town to Upington | 22.7% | 60% | R966,094 | **-R314,691** |
| Johannesburg to East London | 27.8% | 60% | R2,169,866 | **-R268,921** |
| Durban to Gqeberha | 39.3% | 60% | R2,262,709 | **-R256,723** |
| Durban to Pietermaritzburg | 74.0% | 60% | R174,564 | **-R247,688** |
| Cape Town to Bloemfontein | 30.2% | 60% | R1,670,736 | **-R237,661** |
| Cape Town to Paarl | 65.6% | 60% | R77,623 | **-R225,569** |
| Durban to Bloemfontein | 42.3% | 60% | R952,530 | **-R213,925** |
| Cape Town to Worcester | 60.1% | 60% | R276,683 | **-R40,791** |
| Johannesburg to Rustenburg | 64.4% | 60% | R397,365 | **-R28,240** |

The whole reveal is one join: pair an outbound trip with the return it caused, and charge the
cost of both legs against the revenue they jointly earned. Kestrel's reporting measures legs,
so the empty return has never been charged to anything.

Say this out loud: the Johannesburg to Cape Town corridor is their biggest single lane by
revenue and it is their worst by contribution. Nobody running it is doing anything wrong. The
rate card is.

## Finding 2: deliveries that had to be done twice

3,334 drops failed on first attempt in the last twelve months, 4.0% of
everything delivered, costing **R6,509,247** in journeys that earned nothing.

| Site | Failure rate | Failed drops | Cost | Usual reason |
|---|---|---|---|---|
| Atlantis Industries | 45.6% | 411 | R1,046,186 | Goods-in queue timeout |
| Midrand Holdings | 44.5% | 318 | R559,986 | No booked slot |
| Midrand Supplies 3 | 45.5% | 270 | R484,974 | No booked slot |
| Karoo Supplies | 46.3% | 300 | R461,825 | No booked slot |
| Springfield Manufacturing | 32.2% | 156 | R300,268 | Receiving closed |
| Montague Wholesalers | 39.9% | 110 | R212,278 | No booked slot |

These sites are not having bad luck. They have no booked receiving slot, or a goods-in desk
with one person on it. This is a conversation with six customers, not an analysis.

It is invisible in a revenue report by definition: a failed delivery has no revenue to report.

## Finding 3: seven vehicles burning more than their class

Compared against the median of their own class on the same lanes and loads, not against the
fleet, because consumption only means anything against like work.

| Registration | Class | L/100km | Class median | Excess | Cost |
|---|---|---|---|---|---|
| CA219803 | Superlink 34t | 58.22 | 45.9 | +26.7% | R993,267 |
| GP837939 | Superlink 34t | 58.82 | 45.9 | +28.0% | R919,818 |
| GP153377 | Superlink 34t | 55.51 | 45.9 | +20.8% | R716,291 |
| GP993548 | Tri-axle 24t | 45.25 | 37.1 | +22.1% | R632,088 |
| ND548557 | Superlink 34t | 57.29 | 45.9 | +24.7% | R541,316 |
| CA591856 | Tri-axle 24t | 48.11 | 37.1 | +29.8% | R453,583 |
| ND132999 | Tri-axle 24t | 45.61 | 37.1 | +23.0% | R407,321 |

The dashboard cannot say whether this is injectors, dragging brakes, or diesel walking off the
forecourt. It can say these seven are worth the price of a workshop booking to find out.

## Finding 4: Friday, and the last two days of the month

| Dispatch day | On time | Drops |
|---|---|---|
| Month end run | 65.2% | 15,337 |
| Friday | 73.9% | 25,510 |
| Normal day | 95.7% | 119,040 |

Dispatch batches whatever is still standing into one run, trucks leave hours late, and every
drop on the route is late together.

The part that matters commercially is who it lands on:

| Contract | Dispatch day | On time |
|---|---|---|
| Contract | Friday | 56.3% |
| Contract | Month end run | 47.0% |
| Contract | Normal day | 96.0% |
| Dedicated | Friday | 18.2% |
| Dedicated | Month end run | 15.2% |
| Dedicated | Normal day | 95.6% |
| Spot | Friday | 94.8% |
| Spot | Month end run | 86.4% |
| Spot | Normal day | 95.4% |

Dedicated accounts book a two hour window, Contract four, Spot eight. So the customers paying
most for service are the ones failed first, and the ones on the loosest terms barely notice.

Penalty exposure on the anchor account, at 2% of monthly spend per point below 90%:
**R5,213,459**.

## Finding 5: paying to move air

| Class | Air trips | Weight used | Volume used | Cost |
|---|---|---|---|---|
| Superlink 34t | 3,576 | 69.0% | 82.6% | R54,803,779 |
| Tri-axle 24t | 3,620 | 68.8% | 82.4% | R25,292,005 |
| Rigid 14t | 209 | 76.7% | 74.9% | R799,312 |
| Rigid 8t | 113 | 76.6% | 75.0% | R360,653 |
| LDV 1.5t | 97 | 65.8% | 70.7% | R223,229 |

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
