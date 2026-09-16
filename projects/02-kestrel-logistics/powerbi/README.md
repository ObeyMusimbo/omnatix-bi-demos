# Kestrel Logistics in Power BI Desktop

Read [the Lumen guide](../../04-lumen-health/powerbi/README.md) first if you have not: it
explains why this export differs from the web one, and those reasons apply identically here.

Kestrel is the most interesting of the four to model, because it has **three facts at three
different grains** and picking the wrong one produces a number that looks fine and means
nothing.

| Fact | Grain | Answers |
|---|---|---|
| `fct_trip` | one vehicle movement | what did it cost to move, how far, how full |
| `fct_consignment` | one drop at one customer | did we deliver on time, did it fail |
| `fct_round_trip` | an outbound paired with its return | does this lane actually make money |

`fct_round_trip` is where the demo lives. Kestrel's own reporting measures legs, so a corridor
whose outbound is healthy and whose return comes home empty looks profitable and is not.

## Build it

### 1. Export

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py --project 02-kestrel-logistics
```

About 11.5 MB across 15 tables.

### 2. Parameter and queries

Create a text parameter `DataFolder` pointing at `projects/02-kestrel-logistics/powerbi/data`,
then paste each block from `queries.pq` into a blank query.

Import these eight:

```
dim_date   dim_vehicle   dim_driver   dim_customer   dim_lane
fct_trip   fct_consignment   fct_round_trip
```

### 3. Relationships

All one-to-many, single direction, dimension to fact.

| From | To |
|---|---|
| `dim_date[date_day]` | `fct_trip[trip_date]`, `fct_consignment[trip_date]`, `fct_round_trip[trip_date]` |
| `dim_lane[lane_id]` | `fct_trip[lane_id]`, `fct_consignment[lane_id]`, `fct_round_trip[lane_id]` |
| `dim_vehicle[vehicle_id]` | `fct_trip[vehicle_id]` |
| `dim_driver[driver_id]` | `fct_trip[driver_id]` |
| `dim_customer[customer_id]` | `fct_consignment[customer_id]` |

**Do not relate `fct_consignment[trip_id]` to `fct_trip[trip_id]`.** It is the most tempting
join in this model and it will break it. The two already share `dim_date` and `dim_lane`, so
adding a fact to fact relationship gives Power BI two paths between the same tables. It will
either refuse the relationship or resolve it silently, and a silent resolution is worse.

If you need trip attributes on a drop, they are already denormalised onto `fct_consignment`:
`lane_name`, `vehicle_class`, `origin_depot_code`, `trip_date`.

`dim_vehicle` does not relate to `fct_round_trip`. A round trip carries `vehicle_class` but not
a vehicle id, because the return leg is not always the same truck.

### 4. Expect a blank row on the trip side, and leave it there

90 consignments quote a trip that is not in the trip file. Power BI will show this as a blank.
It is the same deliberate referential break as Meridian's unknown SKUs, and the `On Time %`
measure filters `trip_is_known` explicitly so that a service level is only ever measured
against a dispatch that exists.

Do not enable "assume referential integrity" on any relationship here. It switches Power BI to
an inner join and the flagged rows vanish from totals with nothing to say so.

### 5. Model settings

- **Mark `dim_date` as a date table** on `date_day`.
- **Sort `dim_date[month_short]` by `month_num`** and `day_name` by `day_of_week`.
- `dim_date[dispatch_day_bucket]` carries Normal day, Friday and Month end run. It is the axis
  the service level finding is told on, so surface it rather than hiding it.
- **Hide** the id columns on the facts once relationships exist, and the denormalised copies
  (`lane_name`, `vehicle_class`, `customer_name` on the facts) unless you need them for a
  specific visual.
- **Regional settings: English (South Africa).**

### 6. Measures

Paste from `measures.dax`.

The one habit worth carrying out of this model: **divide the sums, never average the ratio.**
`Cost per Km` is total cost over total kilometres. Averaging the per-trip cost per kilometre
gives a 40 km metro run the same weight as a 1,400 km line haul, and the answer is wrong in a
way nobody notices. Same for load factor, which is weighted by capacity rather than averaged.

## Check it before you show it

| Measure | Expected, whole window |
|---|---|
| Trips | 50,652 |
| Kilometres | 23,979,869 |
| Empty Kilometre % | 23.7% |
| Revenue | R469,183,700 |
| Cost | R410,071,057 |
| Contribution | R59,112,642 |
| Drops | 159,977 |
| Failed Drops | 6,557 |
| On Time % | 89.3% |
| Drops With Unknown Trip | 90 |
| Round Trips | 19,950 |
| Empty Return % | 43.6% |
| Round Trip Contribution | R12,148,101 |

That last pair is the demo in two numbers. 19,950 round trips, **8,700 of which came home
empty**, and the contribution once both legs are charged is a fraction of what the leg level
reporting shows.

## A visual worth building first

Put `dim_lane[lane_name]` on rows and `Round Trip Contribution` beside `Outbound Only
Contribution`, sorted by the first. The lanes where the two diverge most are the ones priced as
though the truck comes home loaded when it does not, and the difference is `Backhaul Blind
Spot`, which is already a measure.

## Refreshing

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py --project 02-kestrel-logistics
```

Then **Home → Refresh**.
