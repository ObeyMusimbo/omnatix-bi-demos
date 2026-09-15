-- mart_stockout_impact
--
-- FINDING 4. Puts a number on sales that never happened.
--
-- Grain: one row per SKU x week, for every week in which the Thursday stock count at WH-01
-- read zero for a SKU that runs out chronically.
--
-- Replenishment into WH-01 runs Monday to Wednesday, so the Thursday count is the first
-- honest read on whether the week can be finished. When it reads zero, Friday and Saturday
-- orders for that line simply cannot be filled. None of this is visible in a sales report,
-- because an order that could not be supplied was never written down. It only appears by
-- joining the stock snapshot to what the same SKU normally sells on those two days.

with snapshots as (

    select * from {{ ref('fct_inventory_snapshot') }}

),

sales as (

    select * from {{ ref('fct_sales_line') }}

),

products as (

    select * from {{ ref('dim_product') }}

),

thursday_stock as (

    select
        sku,
        warehouse_code,
        snapshot_date,
        date_trunc('week', snapshot_date)::date as week_start_date,
        units_on_hand,
        units_on_hand = 0 as is_stockout,
    from snapshots
    where warehouse_code = 'WH-01'
      and isodow(snapshot_date) = 4

),

sku_weeks as (

    select
        sku,
        count(*) as thursday_weeks_observed,
        sum(case when is_stockout then 1 else 0 end) as stockout_week_count,
    from thursday_stock
    group by 1

),

weekend_demand as (

    -- Friday and Saturday are the days that cannot be served once Thursday reads zero.
    -- Measured across Modern Trade, which is the channel these lines are stocked for and the
    -- channel that walks away when the order cannot be filled.
    select
        sku,
        date_trunc('week', order_date)::date as week_start_date,
        sum(quantity) as fri_sat_units,
        sum(revenue_zar) as fri_sat_revenue_zar,
    from sales
    where channel = 'Modern Trade'
      and isodow(order_date) in (5, 6)
    group by 1, 2

),

realised_rates as (

    -- Lost units are valued at what the SKU actually sells for in this channel, after the
    -- discounts customers really get - not at list price, which would overstate the loss.
    select
        sku,
        sum(revenue_zar) / nullif(sum(quantity), 0) as avg_realised_price_zar,
        sum(gross_profit_zar) / nullif(sum(quantity), 0) as avg_gross_profit_per_unit_zar,
    from sales
    where channel = 'Modern Trade'
    group by 1

),

baseline_demand as (

    -- Normal Friday and Saturday demand: the same SKU's own weekend volume in the weeks when
    -- Thursday stock was NOT zero. Using the SKU's own good weeks keeps seasonality and
    -- customer mix out of the estimate.
    select
        t.sku,
        avg(coalesce(d.fri_sat_units, 0)) as baseline_fri_sat_units,
        count(*) as baseline_weeks,
    from thursday_stock t
    left join weekend_demand d
        on t.sku = d.sku
        and t.week_start_date = d.week_start_date
    where not t.is_stockout
    group by 1

),

chronic_skus as (

    -- Which SKUs actually have a stock-out problem, decided from the data rather than from a
    -- hardcoded list. Two conditions, both needed:
    --   a) Thursday stock reads zero in at least a fifth of weeks - a pattern, not bad luck.
    --   b) The SKU sells at least a unit a weekend normally, so the estimate is measuring a
    --      real gap rather than the rounding noise of a line that barely moves.
    -- Condition (b) also matters statistically: taking only the shortfall weeks of a
    -- low-volume SKU would manufacture "lost" units out of ordinary week-to-week variation.
    select
        w.sku,
        w.thursday_weeks_observed,
        w.stockout_week_count,
        w.stockout_week_count * 100.0 / nullif(w.thursday_weeks_observed, 0) as stockout_week_pct,
        b.baseline_fri_sat_units,
        b.baseline_weeks,
    from sku_weeks w
    inner join baseline_demand b
        on w.sku = b.sku
    where w.stockout_week_count * 1.0 / nullif(w.thursday_weeks_observed, 0) >= 0.20
      and b.baseline_fri_sat_units >= 1

),

affected_weeks as (

    select
        t.sku,
        t.warehouse_code,
        t.week_start_date,
        t.snapshot_date as thursday_snapshot_date,
        t.units_on_hand as thursday_units_on_hand,
        coalesce(d.fri_sat_units, 0) as actual_fri_sat_units,
    from thursday_stock t
    left join weekend_demand d
        on t.sku = d.sku
        and t.week_start_date = d.week_start_date
    where t.is_stockout

),

final as (

    select
        a.sku,
        p.product_name,
        p.brand,
        p.category,
        p.subcategory,
        a.warehouse_code,
        a.week_start_date,
        strftime(a.week_start_date, '%Y-%m') as year_month,
        a.thursday_snapshot_date,
        a.thursday_units_on_hand,
        c.baseline_fri_sat_units,
        a.actual_fri_sat_units,
        -- The estimate. Whatever normally shipped on Friday and Saturday and did not ship
        -- this week. Floored at zero so a week that somehow beat its baseline cannot be
        -- booked as a negative loss and quietly offset a real one.
        greatest(c.baseline_fri_sat_units - a.actual_fri_sat_units, 0) as lost_units_est,
        r.avg_realised_price_zar,
        r.avg_gross_profit_per_unit_zar,
        greatest(c.baseline_fri_sat_units - a.actual_fri_sat_units, 0)
            * r.avg_realised_price_zar as lost_revenue_zar,
        greatest(c.baseline_fri_sat_units - a.actual_fri_sat_units, 0)
            * r.avg_gross_profit_per_unit_zar as lost_gross_profit_zar,
        c.thursday_weeks_observed,
        c.stockout_week_count,
        c.stockout_week_pct,
    from affected_weeks a
    inner join chronic_skus c
        on a.sku = c.sku
    left join realised_rates r
        on a.sku = r.sku
    left join products p
        on a.sku = p.sku

)

select * from final
