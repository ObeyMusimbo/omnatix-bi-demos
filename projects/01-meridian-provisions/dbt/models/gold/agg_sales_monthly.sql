-- Monthly trading summary. Small enough to ship to a browser whole, which is what the
-- dashboard's overview reads. Grain: month x channel x category.

with lines as (

    select
        date_trunc('month', order_date)::date as month_start_date,
        channel,
        category,
        brand,
        quantity,
        revenue_zar,
        cogs_zar,
        gross_profit_zar,
        allocated_freight_zar,
        allocated_handling_zar,
        allocated_rebate_zar,
        contribution_zar
    from {{ ref('fct_sales_line') }}

),

final as (

    select
        month_start_date,
        strftime(month_start_date, '%Y-%m') as year_month,
        channel,
        category,
        count(*) as sales_line_count,
        sum(quantity) as units,
        sum(revenue_zar) as revenue_zar,
        sum(cogs_zar) as cogs_zar,
        sum(gross_profit_zar) as gross_profit_zar,
        sum(allocated_freight_zar) as allocated_freight_zar,
        sum(allocated_handling_zar) as allocated_handling_zar,
        sum(allocated_rebate_zar) as allocated_rebate_zar,
        sum(contribution_zar) as contribution_zar,
        sum(gross_profit_zar) / nullif(sum(revenue_zar), 0) * 100 as gross_margin_pct,
        sum(contribution_zar) / nullif(sum(revenue_zar), 0) * 100 as contribution_margin_pct
    from lines
    group by 1, 2, 3, 4

)

select * from final
