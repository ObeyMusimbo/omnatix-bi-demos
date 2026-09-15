-- mart_discount_trend
--
-- FINDING 3. Feeds a two-line chart: the realised discount a customer group is actually
-- getting, month by month, against what the rest of its channel is getting. One line climbs
-- and the other is flat.
--
-- Grain: one row per customer group x channel x calendar month.
--
-- "Realised" is the operative word. Nobody ever approved a 15.5% discount for Summit Cash &
-- Carry; it arrived one small concession at a time and was never reset. The only way to see
-- it is to divide what was invoiced by what the price list said, month after month, with the
-- group's branches added together.

with sales as (

    select * from {{ ref('fct_sales_line') }}

),

customers as (

    select * from {{ ref('dim_customer') }}

),

line_level as (

    -- Returns are left in so that the revenue on this mart ties exactly back to
    -- fct_sales_line. A credit note reverses the original discount along with the original
    -- sale, so the ratio is unaffected.
    select
        c.customer_group,
        s.channel,
        date_trunc('month', s.order_date)::date as month_start_date,
        strftime(s.order_date, '%Y-%m') as year_month,
        s.customer_id,
        s.gross_value_zar,
        s.revenue_zar,
        s.discount_value_zar,
    from sales s
    inner join customers c
        on s.customer_id = c.customer_id

),

group_month as (

    select
        customer_group,
        channel,
        month_start_date,
        year_month,
        count(distinct customer_id) as trading_branch_count,
        sum(gross_value_zar) as gross_value_zar,
        sum(revenue_zar) as revenue_zar,
        sum(discount_value_zar) as discount_value_zar,
    from line_level
    group by 1, 2, 3, 4

),

channel_month as (

    -- The comparison line. Two versions are produced: the whole channel, and the channel with
    -- this group taken out. The second is the fairer contrast on a large account, because a
    -- big group otherwise drags the average it is being measured against toward itself.
    select
        channel,
        month_start_date,
        sum(gross_value_zar) as channel_gross_value_zar,
        sum(revenue_zar) as channel_revenue_zar,
        sum(discount_value_zar) as channel_discount_value_zar,
    from line_level
    group by 1, 2

),

group_totals as (

    select
        customer_group,
        channel,
        sum(revenue_zar) as group_total_revenue_zar,
    from line_level
    group by 1, 2

),

company_total as (

    select sum(revenue_zar) as company_total_revenue_zar from line_level

),

baseline_month as (

    -- Where the group started. Finding 3 is the distance between that and where it is now.
    select
        customer_group,
        channel,
        min(month_start_date) as baseline_month_start_date,
    from group_month
    group by 1, 2

),

baseline_rate as (

    select
        b.customer_group,
        b.channel,
        b.baseline_month_start_date,
        gm.discount_value_zar / nullif(gm.gross_value_zar, 0) * 100 as baseline_discount_pct,
    from baseline_month b
    inner join group_month gm
        on b.customer_group = gm.customer_group
        and b.channel = gm.channel
        and b.baseline_month_start_date = gm.month_start_date

),

joined as (

    select
        g.customer_group,
        g.channel,
        g.year_month,
        g.month_start_date,
        g.trading_branch_count,
        g.gross_value_zar,
        g.revenue_zar,
        g.discount_value_zar,
        g.discount_value_zar / nullif(g.gross_value_zar, 0) * 100 as realised_discount_pct,
        c.channel_gross_value_zar,
        c.channel_revenue_zar,
        c.channel_discount_value_zar / nullif(c.channel_gross_value_zar, 0) * 100 as channel_realised_discount_pct,
        (c.channel_discount_value_zar - g.discount_value_zar)
            / nullif(c.channel_gross_value_zar - g.gross_value_zar, 0) * 100 as channel_excl_group_realised_discount_pct,
        r.baseline_month_start_date,
        r.baseline_discount_pct,
        t.group_total_revenue_zar,
        ct.company_total_revenue_zar,
    from group_month g
    inner join channel_month c
        on g.channel = c.channel
        and g.month_start_date = c.month_start_date
    left join baseline_rate r
        on g.customer_group = r.customer_group
        and g.channel = r.channel
    left join group_totals t
        on g.customer_group = t.customer_group
        and g.channel = t.channel
    cross join company_total ct

),

final as (

    select
        customer_group,
        channel,
        year_month,
        month_start_date,
        trading_branch_count,
        gross_value_zar,
        revenue_zar,
        discount_value_zar,
        realised_discount_pct,
        channel_realised_discount_pct,
        channel_excl_group_realised_discount_pct,
        realised_discount_pct - channel_excl_group_realised_discount_pct as discount_gap_vs_channel_pct_pts,
        baseline_month_start_date,
        baseline_discount_pct,
        realised_discount_pct - baseline_discount_pct as discount_creep_pct_pts,
        -- Money left on the table this month purely because the discount drifted: the extra
        -- percentage points, applied to the month's list value.
        gross_value_zar * (realised_discount_pct - baseline_discount_pct) / 100 as revenue_forgone_vs_baseline_zar,
        revenue_zar / nullif(channel_revenue_zar, 0) * 100 as share_of_channel_revenue_pct,
        group_total_revenue_zar,
        group_total_revenue_zar / nullif(company_total_revenue_zar, 0) * 100 as group_share_of_company_revenue_pct,
    from joined

)

select * from final
