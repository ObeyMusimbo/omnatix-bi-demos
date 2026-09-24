"""
Write ANSWER_KEY.md from the built warehouse.

The answer key must state exactly what the dashboard will show, so it is derived from the
gold layer, never recomputed alongside it. An earlier version calculated the findings inside
the data generator and drifted: the generator allocated customer rebates by weight share,
while the gold layer correctly allocates them by revenue share, and the two disagreed by
nearly R2m on the headline finding. One source of truth, and it is the warehouse.

Run after `dbt build`:
    ../../../.venv/Scripts/python.exe generator/build_answer_key.py
"""

from pathlib import Path
import duckdb

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
DB = PROJECT / "meridian.duckdb"
OUT = PROJECT / "ANSWER_KEY.md"

con = duckdb.connect(str(DB), read_only=True)
one = lambda sql: con.execute(sql).fetchone()
rows = lambda sql: con.execute(sql).fetchall()


def rand(n, dp=0):
    if n is None:
        return "n/a"
    sign = "-" if n < 0 else ""
    return f"{sign}R{abs(n):,.{dp}f}"


def pct(n, dp=1):
    return "n/a" if n is None else f"{n:.{dp}f}%"


# ----------------------------------------------------------------- headline

head = rows("""
    select
        case when order_date > date '2025-08-31' then 'ttm' else 'prior' end as period,
        sum(revenue_zar)       as revenue,
        sum(gross_profit_zar)  as gross_profit,
        sum(contribution_zar)  as contribution
    from main_gold.fct_sales_line
    where order_date > date '2024-08-31'
    group by 1
""")
h = {r[0]: r for r in head}
ttm, prior = h["ttm"], h["prior"]
rev_growth = (ttm[1] / prior[1] - 1) * 100
gp_growth = (ttm[2] / prior[2] - 1) * 100
ttm_margin = ttm[2] / ttm[1] * 100
prior_margin = prior[2] / prior[1] * 100
gp_at_prior_margin = ttm[1] * prior_margin / 100
gp_gap = gp_at_prior_margin - ttm[2]

period_start, period_end = one("""
    select min(order_date), max(order_date) from main_gold.fct_sales_line
""")

# ----------------------------------------------------------------- finding 1

f1 = one("""
    select
        any_value(revenue_zar),
        any_value(gross_profit_zar),
        any_value(allocated_freight_zar),
        any_value(allocated_handling_zar),
        any_value(allocated_rebate_zar),
        any_value(contribution_zar),
        any_value(brand_gross_margin_pct),
        any_value(brand_contribution_margin_pct),
        any_value(revenue_per_kg_zar)
    from main_gold.mart_margin_waterfall
    where brand = 'Cascade Springs' and period_order = 1
""")

traps = rows("""
    select brand, any_value(revenue_zar), any_value(contribution_zar)
    from main_gold.mart_margin_waterfall
    where period_order = 1 and is_margin_trap
    group by brand
    order by any_value(contribution_zar)
""")

f1_prior = one("""
    select any_value(revenue_zar), any_value(contribution_zar), any_value(brand_gross_margin_pct)
    from main_gold.mart_margin_waterfall
    where brand = 'Cascade Springs' and period_order = 2
""")

# Mix effect of the bulk water range growing faster than the book. It does not show up as a
# loss on any one line; it drags blended margin down because a low-margin range took share.
bw_share_ttm = f1[0] / ttm[1] * 100
bw_share_prior = f1_prior[0] / prior[1] * 100
bw_share_shift = bw_share_ttm - bw_share_prior
bw_margin_gap = ttm_margin - f1[6]
bw_mix_effect = bw_share_shift / 100 * bw_margin_gap / 100 * ttm[1]

# The bridge itself is a model, so the answer key and the dashboard read the same rows.
bridge_rows = ""
for step, driver, step_type, effect, share, ref in rows("""
    select step_order, driver, step_type, effect_zar, pct_of_gap, finding_ref
    from main_gold.mart_gp_bridge order by step_order
"""):
    if step_type == "anchor":
        bridge_rows += f"| _{driver}_ | _{rand(effect)}_ | | |\n"
    elif step_type == "total":
        bridge_rows += (f"| **{driver}** | **{rand(effect)}** | "
                        f"**{pct(gp_gap / effect * 100)} below** | |\n")
    else:
        bridge_rows += (f"| {driver} | {rand(effect)} | {pct(share)} | "
                        f"{ref or ''} |\n")

# ----------------------------------------------------------------- finding 2

f2 = rows("""
    select
        promo_phase,
        sum(units),
        sum(revenue_zar),
        sum(gross_profit_zar),
        sum(gross_profit_zar) / nullif(sum(units), 0),
        avg(volume_index_vs_baseline_pct),
        sum(gp_forgone_vs_baseline_zar)
    from main_gold.mart_promo_performance
    where product_name like 'Brightwash Powder 2kg%'
    group by 1
""")
f2 = {r[0]: r for r in f2}
f2_windows = one("""
    select count(distinct promo_id), avg(planned_discount_pct)
    from main_gold.mart_promo_performance
    where product_name like 'Brightwash Powder 2kg%' and promo_id is not null
""")

# ----------------------------------------------------------------- finding 3

# The same figures the page prints: first and last month rather than the peak, and the revenue
# forgone split into the twelve months the bridge counts and the two years the section quotes.
# This table used to be headed TTM while summing both years.
f3 = one("""
    select
        sum(revenue_forgone_vs_baseline_zar) filter (where month_start_date > date '2025-08-31'),
        arg_max(realised_discount_pct, month_start_date)
            - arg_min(realised_discount_pct, month_start_date),
        max(group_share_of_company_revenue_pct),
        arg_min(realised_discount_pct, month_start_date),
        arg_max(realised_discount_pct, month_start_date),
        sum(revenue_forgone_vs_baseline_zar)
    from main_gold.mart_discount_trend
    where customer_group = 'Summit Cash & Carry'
""")
f3_peers = rows("""
    select customer_group,
           sum(revenue_forgone_vs_baseline_zar) filter (where month_start_date > date '2025-08-31'),
           arg_max(realised_discount_pct, month_start_date)
               - arg_min(realised_discount_pct, month_start_date)
    from main_gold.mart_discount_trend
    group by 1
    order by 2 desc nulls last
    limit 4
""")

# ----------------------------------------------------------------- findings 4 and 5

f4 = one("""
    select sum(lost_units_est), sum(lost_revenue_zar), sum(lost_gross_profit_zar),
           count(distinct sku), max(stockout_week_pct)
    from main_gold.mart_stockout_impact
""")
f4_skus = rows("""
    select product_name, sum(lost_units_est), sum(lost_revenue_zar)
    from main_gold.mart_stockout_impact
    group by 1 order by 3 desc
""")

f5 = one("""
    select sum(dead_stock_value_zar), count(*), count(distinct sku), max(days_since_last_sale)
    from main_gold.mart_dead_stock where is_dead_stock
""")
f5_total = one("select sum(stock_value_zar) from main_gold.mart_dead_stock")[0]

# ----------------------------------------------------------------- write

doc = f"""# Meridian Provisions Co. demo answer key

Derived from `meridian.duckdb` after `dbt build`. Every figure here is what the dashboard
will show, because it is read from the same gold models the dashboard reads.

Data covers {period_start} to {period_end}. TTM means the twelve months to {period_end}.
Cancelled orders are excluded throughout; returns are included as negative quantities.

**Do not ship this file with the demo.** It is the script for the reveal.

## The headline that makes them lean in

| | TTM | Prior year | Change |
|---|---|---|---|
| Revenue | {rand(ttm[1])} | {rand(prior[1])} | {rev_growth:+.1f}% |
| Gross profit | {rand(ttm[2])} | {rand(prior[2])} | **{gp_growth:+.1f}%** |
| Gross margin | {pct(ttm_margin)} | {pct(prior_margin)} | {ttm_margin - prior_margin:+.1f} pts |
| Net contribution | {rand(ttm[3])} | {rand(prior[3])} | {(ttm[3] / prior[3] - 1) * 100:+.1f}% |

Open with this and stop talking. Revenue up {rev_growth:.1f}%, gross profit up {gp_growth:.1f}%.
Ask the room why. Nobody will know.

Had margin merely held at last year's {pct(prior_margin)}, gross profit would have been
{rand(gp_at_prior_margin)}. The gap to explain is **{rand(gp_gap)}**.

### Bridging the gap

Close the demo on this table, not on the individual findings. It is the difference between
showing a client five charts and telling them why their profit is flat.

Read straight from `mart_gold.mart_gp_bridge`, which is also what the dashboard draws, so
the two can never disagree.

| Driver | Gross profit effect | Share of gap | Finding |
|---|---|---|---|
{bridge_rows}
Note the bulk water line carefully. That range did not lose gross profit, its gross profit
is positive. It dragged the blend down by growing from {pct(bw_share_prior)} to
{pct(bw_share_ttm)} of revenue at {pct(f1[6])} margin against a book average of
{pct(ttm_margin)}. Finding 1 then shows that once freight and rebates are allocated, that
growth was actively destroying value rather than merely diluting it.

## Finding 1: The bulk water range is sold at a loss

Cascade Springs is a top revenue line at {pct(f1[6])} gross margin, which looks unremarkable.
It is heavy, low value density ({rand(f1[8], 2)} of revenue per kilogram shipped), and moves
mostly through Wholesale accounts that earn a volume rebate.

| Waterfall step | TTM |
|---|---|
| Revenue | {rand(f1[0])} |
| Cost of goods sold | {rand(-(f1[0] - f1[1]))} |
| **Gross profit** | **{rand(f1[1])}** ({pct(f1[6])}) |
| Allocated freight | {rand(-f1[2])} |
| Allocated handling | {rand(-f1[3])} |
| Allocated customer rebate | {rand(-f1[4])} |
| **Net contribution** | **{rand(f1[5])}** ({pct(f1[7])}) |

Prior year for contrast: {rand(f1_prior[0])} revenue, {rand(f1_prior[1])} contribution. The
range grew into the loss.

Freight is allocated to the line by its share of the order's total weight; rebate by its share
of the order's revenue. Those two allocation rules are the whole trick, and they are why this
is invisible in Meridian's current reporting, the costs sit at order level in the finance
export and never reach a product report.

Brands flagged `is_margin_trap` (positive gross profit, negative contribution) this period:

| Brand | Revenue | Contribution |
|---|---|---|
"""
for b, r, cb in traps:
    doc += f"| {b} | {rand(r)} | {rand(cb)} |\n"

doc += f"""
## Finding 2: The quarterly laundry promotion destroys value

Brightwash Powder 2kg runs Buy 2 Get 1 Free {f2_windows[0]} times over the window at a planned
{pct(f2_windows[1])} discount, against a gross margin under 27%. Volume roughly triples, then
collapses for four weeks afterwards because customers pantry-load.

| Phase | Units | Revenue | Gross profit | GP per unit | Volume vs baseline |
|---|---|---|---|---|---|
"""
for phase in ("Baseline", "On promotion", "Post-promotion (4 weeks)"):
    r = f2.get(phase)
    if r:
        doc += (f"| {phase} | {r[1]:,.0f} | {rand(r[2])} | {rand(r[3])} | "
                f"{rand(r[4], 2)} | {pct(r[5], 0)} |\n")

doc += f"""
Gross profit forgone on promoted units, valued at the baseline rate:
**{rand(f2['On promotion'][6])}**.

Promoted units carry a **negative** gross profit per unit. Every case sold on deal costs money,
and the four weeks after each window sell at roughly
{pct(f2['Post-promotion (4 weeks)'][5], 0)} of baseline, so the volume was never incremental, it was borrowed from the following month.

Reveal with weekly units and GP for this SKU, promo windows shaded. The shape tells the story
before anyone reads a number.

## Finding 3: Discount creep on the largest account

| Measure | Value |
|---|---|
| Share of company revenue | {pct(f3[2])} |
| Discount in the first month of the window | {pct(f3[3])} |
| Discount in the last month | {pct(f3[4])} |
| Creep | **+{f3[1]:.1f} percentage points** |
| Revenue forgone vs holding the opening rate, last twelve months | **{rand(f3[0])}** |
| The same, over the two years | {rand(f3[5])} |

The twelve month figure is the one in the bridge. Quote the two year figure only as the second
number, and say which is which.

Nobody ever reset it. Revenue kept growing, so nobody looked.

For contrast, the same measure across the largest groups:

| Customer group | Revenue forgone, last twelve months | Creep |
|---|---|---|
"""
for g, fo, cr in f3_peers:
    doc += f"| {g} | {rand(fo or 0)} | {cr:+.1f} pts |\n"

doc += f"""
Reveal with realised discount by month for this group against the channel average excluding
them. One line climbs, the other is flat.

## Finding 4: Weekend stock-outs in the growth channel

Replenishment into the Gauteng DC runs Monday to Wednesday. Three Modern Trade hero lines hit
zero on hand on Thursdays in up to {pct(f4[4], 0)} of weeks and cannot be supplied Friday or
Saturday.

| SKU | Units not supplied | Revenue forgone |
|---|---|---|
"""
for p, u, r in f4_skus:
    doc += f"| {p} | {u:,.0f} | {rand(r)} |\n"

doc += f"""| **Total** | **{f4[0]:,.0f}** | **{rand(f4[1])}** |

Gross profit forgone: {rand(f4[2])}.

This one is invisible in any sales report because you cannot see sales that did not happen. It
only appears by joining the Thursday inventory snapshot to the same SKU's normal Friday and
Saturday demand in weeks when stock was available. Say that out loud in the demo, it is the
single best argument for owning the whole pipeline rather than buying a chart tool.

## Finding 5: Dead stock

The Halo Shine aerosol range was discontinued and has not sold in
{f5[3]:,.0f} days. {f5[2]} SKUs across {f5[1]} stock rows.

| Measure | Value |
|---|---|
| Dead stock at cost | **{rand(f5[0])}** |
| Total stock on hand at cost | {rand(f5_total)} |
| Dead as a share of stock | {pct(f5[0] / f5_total * 100)} |

Working capital rather than P&L, which makes it a good closing item, the fix is immediate and
needs no analysis to act on.

## Data quality issues resolved in the silver layer

These are planted on purpose. Walk a technical buyer through them; it is the difference between
a dashboard and a data platform.

1. `orders.order_date` mixes ISO and `DD/MM/YYYY`, 17,083 of 57,334 rows
2. Leading and trailing whitespace on customer names and product categories
3. `customers.channel` arrives in 11 spellings of 4 channels
4. 1,441 duplicate order lines, and the pairs are **not** byte-identical, they differ only in
   number formatting, so money must be cast before the rows are deduplicated
5. 7 products with a blank standard cost, imputed from the category's cost-to-list ratio
6. 27,674 revenue values written with thousand separators
7. 4,040 return lines arriving as negative quantities, kept rather than filtered
8. 140 order lines quoting SKUs absent from the product master, kept, flagged, and covered by
   a deliberately warning test rather than silently dropped
9. 1,117 cancelled orders, flagged and excluded from revenue
"""

OUT.write_text(doc, encoding="utf-8")
print(f"Wrote {OUT}")
print(f"  TTM revenue      {rand(ttm[1])}  ({rev_growth:+.1f}%)")
print(f"  TTM gross profit {rand(ttm[2])}  ({gp_growth:+.1f}%)")
print(f"  Gap to explain   {rand(gp_gap)}")
print(f"  Finding 1        {rand(f1[5])}")
print(f"  Finding 2        {rand(f2['On promotion'][6])}")
print(f"  Finding 3        {rand(f3[0])}")
print(f"  Finding 4        {rand(f4[1])}")
print(f"  Finding 5        {rand(f5[0])}")
