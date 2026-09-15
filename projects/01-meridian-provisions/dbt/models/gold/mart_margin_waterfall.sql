-- mart_margin_waterfall
--
-- FINDING 1. Feeds a waterfall chart that walks a brand from revenue down to true
-- contribution: revenue, less cost of goods, to gross profit, then the three order-level
-- costs allocated down to the line, ending at contribution.
--
-- Grain: one row per period x brand x waterfall step. Each row is one bar on the chart, and
-- every row also carries the brand's headline totals so a tooltip or KPI tile needs no
-- second query.
--
-- The Cascade Springs bulk water range is the point of the chart: healthy on gross margin,
-- below zero once the freight it actually consumes and the rebates its wholesale customers
-- earn are charged against it.

with sales as (

    select * from {{ ref('fct_sales_line') }}

),

products as (

    select * from {{ ref('dim_product') }}

),

periods as (

    -- Two rolling years ending on the last day of data. Held as a project variable so the
    -- demo can be re-pointed at another window without editing model SQL.
    select
        'Trailing twelve months' as period_label,
        1 as period_order,
        (date '{{ var("period_end") }}' - interval 12 month + interval 1 day)::date as period_start,
        date '{{ var("period_end") }}' as period_end

    union all

    select
        'Prior twelve months',
        2,
        (date '{{ var("period_end") }}' - interval 24 month + interval 1 day)::date,
        (date '{{ var("period_end") }}' - interval 12 month)::date

),

brand_period as (

    select
        p.period_label,
        p.period_order,
        p.period_start,
        p.period_end,
        s.brand,
        -- A brand sits in exactly one category in Meridian's range; max() simply picks it.
        max(s.category) as category,
        bool_or(dp.is_bulk_water) as is_bulk_water,
        sum(s.quantity) as units,
        count(*) as sales_line_count,
        sum(s.revenue_zar) as revenue_zar,
        sum(s.cogs_zar) as cogs_zar,
        sum(s.gross_profit_zar) as gross_profit_zar,
        sum(s.allocated_freight_zar) as allocated_freight_zar,
        sum(s.allocated_handling_zar) as allocated_handling_zar,
        sum(s.allocated_rebate_zar) as allocated_rebate_zar,
        sum(s.contribution_zar) as contribution_zar,
        sum(s.line_weight_kg) as weight_kg,
    from sales s
    inner join periods p
        on s.order_date between p.period_start and p.period_end
    left join products dp
        on s.sku = dp.sku
    group by
        p.period_label,
        p.period_order,
        p.period_start,
        p.period_end,
        s.brand

),

brand_period_rates as (

    select
        b.*,
        b.gross_profit_zar / nullif(b.revenue_zar, 0) * 100 as brand_gross_margin_pct,
        b.contribution_zar / nullif(b.revenue_zar, 0) * 100 as brand_contribution_margin_pct,
        -- Rand of revenue per kilogram shipped. The lower this is, the more damage a
        -- weight-based freight allocation does - which is the mechanism behind finding 1.
        b.revenue_zar / nullif(b.weight_kg, 0) as revenue_per_kg_zar,
    from brand_period b

),

steps as (

    -- The waterfall, unpivoted one step per row. step_value_zar is signed the way the bar
    -- should be drawn; running_total_zar is where the bar lands on the axis.
    select b.*, 1 as step_order, 'Revenue' as step_label, 'total' as step_type,
           b.revenue_zar as step_value_zar,
           b.revenue_zar as running_total_zar
    from brand_period_rates b

    union all
    select b.*, 2, 'Cost of goods sold', 'delta',
           -b.cogs_zar,
           b.revenue_zar - b.cogs_zar
    from brand_period_rates b

    union all
    select b.*, 3, 'Gross profit', 'total',
           b.gross_profit_zar,
           b.gross_profit_zar
    from brand_period_rates b

    union all
    select b.*, 4, 'Allocated freight', 'delta',
           -b.allocated_freight_zar,
           b.gross_profit_zar - b.allocated_freight_zar
    from brand_period_rates b

    union all
    select b.*, 5, 'Allocated handling', 'delta',
           -b.allocated_handling_zar,
           b.gross_profit_zar - b.allocated_freight_zar - b.allocated_handling_zar
    from brand_period_rates b

    union all
    select b.*, 6, 'Allocated customer rebate', 'delta',
           -b.allocated_rebate_zar,
           b.contribution_zar
    from brand_period_rates b

    union all
    select b.*, 7, 'Net contribution', 'total',
           b.contribution_zar,
           b.contribution_zar
    from brand_period_rates b

),

final as (

    select
        period_label,
        period_order,
        period_start,
        period_end,
        brand,
        category,
        is_bulk_water,
        step_order,
        step_label,
        step_type,
        step_value_zar,
        running_total_zar,
        step_value_zar / nullif(revenue_zar, 0) * 100 as step_pct_of_revenue,
        units,
        sales_line_count,
        revenue_zar,
        cogs_zar,
        gross_profit_zar,
        allocated_freight_zar,
        allocated_handling_zar,
        allocated_rebate_zar,
        contribution_zar,
        weight_kg,
        brand_gross_margin_pct,
        brand_contribution_margin_pct,
        revenue_per_kg_zar,
        -- The headline of finding 1 in one boolean: positive on gross profit, negative once
        -- the order-level costs are allocated down.
        gross_profit_zar > 0 and contribution_zar < 0 as is_margin_trap,
    from steps

)

select * from final
