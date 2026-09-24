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
DB = PROJECT / "kestrel.duckdb"
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


h = one("""
    select any_value(ttm_revenue_zar), any_value(ttm_cost_zar), any_value(ttm_contribution_zar),
           any_value(ttm_contribution_margin_pct), any_value(ttm_km),
           any_value(ttm_cost_per_km_zar), any_value(ttm_revenue_per_km_zar),
           any_value(identified_zar), any_value(identified_pct_of_contribution)
    from main_gold.mart_opportunity_bridge
""")
(ttm_rev, ttm_cost, ttm_contrib, contrib_pct, ttm_km,
 cost_km, rev_km, identified, identified_pct) = h

period_from, period_through = one("select min(trip_date), max(trip_date) from main_gold.fct_trip")

empty = one("""
    select round(sum(distance_km) filter (where is_empty)),
           round(sum(distance_km)),
           round(sum(distance_km) filter (where is_empty) * 100.0 / sum(distance_km), 1),
           round(sum(total_cost_zar) filter (where is_empty))
    from main_gold.fct_trip
    where trip_date > date '2025-08-31'
""")

bridge = rows("""
    select step_order, driver, step_type, effect_zar, pct_of_identified, finding_ref
    from main_gold.mart_opportunity_bridge order by step_order
""")

traps = rows("""
    select lane_name, round(actual_backhaul_pct, 1), round(assumed_backhaul_pct),
           round(outbound_only_contribution_zar), round(contribution_zar), round(empty_return_cost_zar)
    from main_gold.mart_lane_economics
    where period_order = 1 and is_backhaul_trap
    order by contribution_zar
""")

# Every query below reads the same twelve months as the page and the bridge, through the flag
# the marts carry, so this script cannot quote a two year figure beside a one year close.
sites = rows("""
    select customer_name, round(sum(failed_drops) * 100.0 / sum(drops), 1), sum(failed_drops),
           round(sum(failed_cost_zar)), any_value(top_failure_reason)
    from main_gold.mart_failed_deliveries
    where is_trailing_twelve_months
    group by 1
    having sum(failed_drops) * 1.0 / sum(drops) > 0.15
    order by 4 desc limit 6
""")
fail_all = one("""
    select round(sum(failed_cost_zar)), sum(failed_drops),
           round(sum(failed_drops) * 100.0 / sum(drops), 2)
    from main_gold.mart_failed_deliveries
    where is_trailing_twelve_months
""")

thirsty = rows("""
    select registration, vehicle_class, litres_per_100km, round(class_median_l100, 1),
           excess_pct, round(excess_cost_zar), depot_name
    from main_gold.mart_fuel_outliers where is_outlier order by excess_cost_zar desc
""")

sla = rows("""
    select dispatch_day_bucket, round(sum(on_time_drops) * 100.0 / sum(drops), 1), sum(drops)
    from main_gold.mart_sla_performance where is_trailing_twelve_months group by 1 order by 2
""")
sla_contract = rows("""
    select contract_type, dispatch_day_bucket,
           round(sum(on_time_drops) * 100.0 / sum(drops), 1)
    from main_gold.mart_sla_performance
    where is_trailing_twelve_months
    group by 1, 2 order by 1, 2
""")
penalty = one("""
    select round(sum(penalty_exposure_zar))
    from main_gold.mart_sla_performance where is_trailing_twelve_months
""")[0]

air = rows("""
    select vehicle_class, sum(air_trips), round(avg(avg_weight_utilisation_pct), 1),
           round(avg(avg_volume_utilisation_pct), 1), round(sum(air_trip_cost_zar))
    from main_gold.mart_load_factor group by 1 having sum(air_trips) > 0 order by 5 desc
""")

# Computed rather than typed. The script used to say each finding was "a fifth to a third" of
# the total and that half of it "doubles their margin"; neither survived the numbers changing.
shares = [s for _, _, t, _, s, _ in bridge if t == "increase"]

bridge_rows = ""
for step, driver, step_type, effect, share, ref in bridge:
    if step_type == "anchor":
        bridge_rows += f"| _{driver}_ | _{rand(effect)}_ | | |\n"
    elif step_type == "total":
        bridge_rows += f"| **{driver}** | **{rand(effect)}** | | |\n"
    else:
        bridge_rows += f"| {driver} | {rand(effect)} | {pct(share)} | {ref or ''} |\n"

trap_rows = "".join(
    f"| {n} | {a}% | {int(b)}% | {rand(c)} | **{rand(d)}** |\n" for n, a, b, c, d, _ in traps
)
site_rows = "".join(
    f"| {n} | {r}% | {num(d)} | {rand(c)} | {reason} |\n" for n, r, d, c, reason in sites
)
thirsty_rows = "".join(
    f"| {reg} | {cls} | {l} | {med} | +{ex}% | {rand(cost)} |\n"
    for reg, cls, l, med, ex, cost, _ in thirsty
)
sla_rows = "".join(f"| {b} | {p}% | {num(d)} |\n" for b, p, d in sla)
contract_rows = "".join(f"| {a} | {b} | {c}% |\n" for a, b, c in sla_contract)
air_rows = "".join(
    f"| {c} | {num(t)} | {w}% | {v}% | {rand(cost)} |\n" for c, t, w, v, cost in air
)

doc = f"""# Kestrel Logistics demo answer key

Derived from `kestrel.duckdb` after `dbt build`. Every figure here is what the dashboard will
show, because it reads the same gold models.

Data covers {period_from} to {period_through}. TTM means the twelve months to {period_through}.
All money is South African rand, excluding VAT.

**Do not ship this file with the demo.** It is the script for the reveal.

## The headline

| Measure | TTM |
|---|---|
| Revenue | {rand(ttm_rev)} |
| Cost | {rand(ttm_cost)} |
| Contribution | {rand(ttm_contrib)} ({pct(contrib_pct)}) |
| Kilometres | {num(ttm_km)} |
| Earned per kilometre | {rand(rev_km, 2)} |
| Spent per kilometre | {rand(cost_km, 2)} |
| **Kilometres run empty** | **{pct(empty[2])}** of {num(empty[1])} km |
| Cost of those empty kilometres | {rand(empty[3])} |

Open on the map, not on a number. Colour the corridors by what they contribute as a round trip
and four of them are red. Then say the line: nearly a quarter of every kilometre this fleet
turns is carrying nothing, and until today nobody was charged for it.

## The close

| Driver | Worth | Share | Finding |
|---|---|---|---|
{bridge_rows}
**{rand(identified)} identified against {rand(ttm_contrib)} earned, or {pct(identified_pct)} of
contribution.** Four findings, each worth {pct(min(shares), 0)} to {pct(max(shares), 0)} of the
total, on the same fleet serving the same customers with nothing new bought. Every step covers
the same twelve months.

Do not promise full recovery. A lane can be repriced or dropped, a receiving problem is a
conversation, an injector is a workshop booking. Half of this inside a year is a serious result
and still lifts contribution by {pct(identified / 2 / ttm_contrib * 100, 0)}.

## Finding 1: corridors that fund their own empty return

Every lane was priced assuming 60% of the return leg would sell. Nobody revisited it corridor
by corridor. On these lanes the outbound leg looks healthy and the round trip loses money.

| Lane | Backhaul actual | Assumed | Looks like | Actually |
|---|---|---|---|---|
{trap_rows}
The whole reveal is one join: pair an outbound trip with the return it caused, and charge the
cost of both legs against the revenue they jointly earned. Kestrel's reporting measures legs,
so the empty return has never been charged to anything.

Say this out loud: the Johannesburg to Cape Town corridor is their biggest single lane by
revenue and it is their worst by contribution. Nobody running it is doing anything wrong. The
rate card is.

## Finding 2: deliveries that had to be done twice

{num(fail_all[1])} drops failed on first attempt in the last twelve months, {pct(fail_all[2])} of
everything delivered, costing **{rand(fail_all[0])}** in journeys that earned nothing.

| Site | Failure rate | Failed drops | Cost | Usual reason |
|---|---|---|---|---|
{site_rows}
These sites are not having bad luck. They have no booked receiving slot, or a goods-in desk
with one person on it. This is a conversation with six customers, not an analysis.

It is invisible in a revenue report by definition: a failed delivery has no revenue to report.

## Finding 3: seven vehicles burning more than their class

Compared against the median of their own class on the same lanes and loads, not against the
fleet, because consumption only means anything against like work.

| Registration | Class | L/100km | Class median | Excess | Cost |
|---|---|---|---|---|---|
{thirsty_rows}
The dashboard cannot say whether this is injectors, dragging brakes, or diesel walking off the
forecourt. It can say these seven are worth the price of a workshop booking to find out.

## Finding 4: Friday, and the last two days of the month

| Dispatch day | On time | Drops |
|---|---|---|
{sla_rows}
Dispatch batches whatever is still standing into one run, trucks leave hours late, and every
drop on the route is late together.

The part that matters commercially is who it lands on:

| Contract | Dispatch day | On time |
|---|---|---|
{contract_rows}
Dedicated accounts book a two hour window, Contract four, Spot eight. So the customers paying
most for service are the ones failed first, and the ones on the loosest terms barely notice.

Penalty exposure on the anchor account, at 2% of monthly spend per point below 90%:
**{rand(penalty)}**.

## Finding 5: paying to move air

| Class | Air trips | Weight used | Volume used | Cost |
|---|---|---|---|---|
{air_rows}
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
"""

OUT.write_text(doc, encoding="utf-8")
print(f"Wrote {OUT}")
print(f"  TTM revenue      {rand(ttm_rev)}")
print(f"  TTM contribution {rand(ttm_contrib)}  ({pct(contrib_pct)})")
print(f"  Identified       {rand(identified)}  ({pct(identified_pct)} of contribution)")
print(f"  Empty kilometres {pct(empty[2])} costing {rand(empty[3])}")
