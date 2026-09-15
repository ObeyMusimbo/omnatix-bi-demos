-- Monthly performance per SKU. Feeds the dashboard's product tables and answers the
-- ordinary questions a trader asks first - what moved most last month, what is shrinking -
-- without shipping the 288k-row fact table to the browser.

with lines as (

    select
        date_trunc('month', order_date)::date as month_start_date,
        sku,
        product_name,
        brand,
        category,
        subcategory,
        quantity,
        revenue_zar,
        cogs_zar,
        gross_profit_zar,
        allocated_freight_zar,
        allocated_rebate_zar,
        contribution_zar,
        line_weight_kg,
        is_on_promo
    from {{ ref('fct_sales_line') }}
    where sku_is_known

),

final as (

    select
        month_start_date,
        strftime(month_start_date, '%Y-%m') as year_month,
        sku,
        product_name,
        brand,
        category,
        subcategory,
        sum(quantity) as units,
        sum(revenue_zar) as revenue_zar,
        sum(gross_profit_zar) as gross_profit_zar,
        sum(allocated_freight_zar) as allocated_freight_zar,
        sum(allocated_rebate_zar) as allocated_rebate_zar,
        sum(contribution_zar) as contribution_zar,
        sum(line_weight_kg) as weight_kg,
        sum(case when is_on_promo then quantity else 0 end) as promoted_units,
        sum(gross_profit_zar) / nullif(sum(revenue_zar), 0) * 100 as gross_margin_pct,
        sum(contribution_zar) / nullif(sum(revenue_zar), 0) * 100 as contribution_margin_pct,
        -- Revenue earned per kilogram shipped. Low values are the tell for a freight trap:
        -- the range is cheap and heavy, so delivery eats the margin.
        sum(revenue_zar) / nullif(sum(line_weight_kg), 0) as revenue_per_kg_zar
    from lines
    group by 1, 2, 3, 4, 5, 6, 7

)

select * from final
