-- mart_promo_performance
--
-- FINDING 2. Feeds the weekly promotion chart: units and profit per week for every promoted
-- SKU, with each week labelled as on promotion, in the four-week hangover that follows, or
-- baseline trading.
--
-- Grain: one row per SKU x trading week x promotion phase. A week normally produces one row.
-- It produces two only where a promotion starts or ends mid-week, in which case each part of
-- the week is reported separately rather than being averaged into a misleading single value.
--
-- The mart answers two questions from the same rows:
--   1. On promotion vs off promotion - group by promo_phase and compare gp_per_unit_zar.
--   2. The pantry-loading hangover - plot volume_index_vs_baseline_pct by week, which drops
--      to roughly 45 for the four weeks after each Brightwash window closes.

with sales as (

    select * from {{ ref('fct_sales_line') }}

),

promotions as (

    select * from {{ ref('sl_promotions') }}

),

products as (

    select * from {{ ref('dim_product') }}

),

promo_calendar as (

    select
        promo_id,
        promo_name,
        sku,
        mechanic,
        funding_source,
        start_date,
        end_date,
        -- Pantry loading shows up in the four weeks after the window closes: customers bought
        -- three months of stock at the promotional price and simply stop ordering.
        (end_date + 1)::date as hangover_start_date,
        (end_date + 28)::date as hangover_end_date,
        -- The silver contract does not fix the scale of planned_discount_pct and the source
        -- file carries it as a fraction (0.333 for buy-two-get-one-free). It is normalised
        -- here to the same 0-100 scale the order lines use, so planned and realised discount
        -- can be put side by side.
        case
            when planned_discount_pct <= 1 then planned_discount_pct * 100
            else planned_discount_pct
        end as planned_discount_pct,
    from promotions

),

promo_days as (

    -- The promotion calendar exploded to one row per SKU per day, so that a week which is
    -- only partly on promotion is classified correctly rather than by its start date.
    select
        sku,
        promo_id,
        promo_name,
        mechanic,
        funding_source,
        planned_discount_pct,
        unnest(generate_series(start_date, end_date, interval 1 day))::date as calendar_day,
        1 as phase_rank,
        'On promotion' as promo_phase,
    from promo_calendar

    union all

    select
        sku,
        promo_id,
        promo_name,
        mechanic,
        funding_source,
        planned_discount_pct,
        unnest(generate_series(hangover_start_date, hangover_end_date, interval 1 day))::date,
        2,
        'Post-promotion (4 weeks)',
    from promo_calendar

),

promo_day_ranked as (

    -- Where two promotions on the same SKU overlap, a live promotion always beats another
    -- promotion's hangover, so each SKU-day resolves to exactly one phase.
    select *
    from promo_days
    qualify row_number() over (partition by sku, calendar_day order by phase_rank, promo_id) = 1

),

promoted_skus as (

    select distinct sku from promo_calendar

),

promo_lines as (

    -- Only SKUs that have ever been promoted. Everything else would be noise on this chart.
    select s.*
    from sales s
    inner join promoted_skus ps
        on s.sku = ps.sku

),

lines_phased as (

    select
        l.*,
        coalesce(d.promo_phase, 'Baseline') as promo_phase,
        d.promo_id as phase_promo_id,
        d.promo_name as phase_promo_name,
        d.mechanic,
        d.funding_source,
        d.planned_discount_pct,
    from promo_lines l
    left join promo_day_ranked d
        on l.sku = d.sku
        and l.order_date = d.calendar_day

),

weekly as (

    -- Weeks start on Monday. Meridian does not trade on Sundays, so a Monday-start week
    -- contains exactly the same trading days as the Sunday-to-Saturday promotion windows,
    -- and the windows line up with week boundaries on the chart.
    select
        sku,
        date_trunc('week', order_date)::date as week_start_date,
        promo_phase,
        min(phase_promo_id) as promo_id,
        min(phase_promo_name) as promo_name,
        min(mechanic) as mechanic,
        min(funding_source) as funding_source,
        min(planned_discount_pct) as planned_discount_pct,
        count(*) as sales_line_count,
        sum(quantity) as units,
        sum(gross_value_zar) as gross_value_zar,
        sum(discount_value_zar) as discount_value_zar,
        sum(revenue_zar) as revenue_zar,
        sum(cogs_zar) as cogs_zar,
        sum(gross_profit_zar) as gross_profit_zar,
        sum(contribution_zar) as contribution_zar,
    from lines_phased
    group by 1, 2, 3

),

baseline as (

    -- Normal trading for the SKU: its own average week when no promotion is running and it
    -- is not in the shadow of one. Using the SKU's own baseline keeps seasonality, channel
    -- mix and list price out of the comparison.
    select
        sku,
        avg(units) as baseline_units_per_week,
        sum(gross_profit_zar) / nullif(sum(units), 0) as baseline_gp_per_unit_zar,
        sum(revenue_zar) / nullif(sum(units), 0) as baseline_revenue_per_unit_zar,
        sum(gross_profit_zar) / nullif(sum(revenue_zar), 0) * 100 as baseline_gross_margin_pct,
    from weekly
    where promo_phase = 'Baseline'
    group by 1

),

final as (

    select
        w.sku,
        p.product_name,
        p.brand,
        p.category,
        p.subcategory,
        w.week_start_date,
        strftime(w.week_start_date, '%Y-%m') as year_month,
        w.promo_phase,
        w.promo_phase = 'On promotion' as is_on_promo_week,
        w.promo_id,
        w.promo_name,
        w.mechanic,
        w.funding_source,
        w.planned_discount_pct,
        w.sales_line_count,
        w.units,
        w.gross_value_zar,
        w.discount_value_zar,
        w.revenue_zar,
        w.cogs_zar,
        w.gross_profit_zar,
        w.contribution_zar,
        w.gross_profit_zar / nullif(w.revenue_zar, 0) * 100 as gross_margin_pct,
        -- What the customer actually got off, as opposed to what the promotion planned.
        w.discount_value_zar / nullif(w.gross_value_zar, 0) * 100 as realised_discount_pct,
        w.gross_profit_zar / nullif(w.units, 0) as gp_per_unit_zar,
        w.revenue_zar / nullif(w.units, 0) as revenue_per_unit_zar,
        b.baseline_units_per_week,
        b.baseline_gp_per_unit_zar,
        b.baseline_revenue_per_unit_zar,
        b.baseline_gross_margin_pct,
        -- 100 means a normal week. Promotion weeks run far above it; the four weeks after a
        -- window closes sit well below it. This is the hangover, in one column.
        w.units / nullif(b.baseline_units_per_week, 0) * 100 as volume_index_vs_baseline_pct,
        -- Profit given up on the week's volume, valued at what the same units would have
        -- earned in a normal week. Positive means the week made less than baseline economics
        -- would have. Summed over On promotion weeks this is the cost of the promotion.
        w.units * (b.baseline_gp_per_unit_zar - (w.gross_profit_zar / nullif(w.units, 0))) as gp_forgone_vs_baseline_zar,
        -- Volume lost against a normal week. Meaningful on post-promotion weeks, where it
        -- quantifies the sales that were pulled forward into the promotion.
        greatest(b.baseline_units_per_week - w.units, 0) as units_below_baseline,
    from weekly w
    left join baseline b
        on w.sku = b.sku
    left join products p
        on w.sku = p.sku

)

select * from final
