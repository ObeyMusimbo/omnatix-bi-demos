-- mart_dead_stock
--
-- FINDING 5. What is sitting in the warehouses that nobody is buying any more.
--
-- Grain: one row per SKU x distribution centre, as at the most recent stock count.
--
-- Live stock is included alongside dead stock deliberately, so the chart can show the dead
-- pile against the total it is part of rather than as a number with no scale. Filter on
-- is_dead_stock for the finding itself.
--
-- This is a working capital problem, not a profit problem, which is what makes it a good
-- closing item: the cash is already spent and the fix is immediate.

with snapshots as (

    select * from {{ ref('fct_inventory_snapshot') }}

),

sales as (

    select * from {{ ref('fct_sales_line') }}

),

products as (

    select * from {{ ref('dim_product') }}

),

warehouses as (

    select * from {{ ref('sl_warehouses') }}

),

as_of as (

    -- "Days since last sale" is measured against the last day the business traded, not
    -- against today, so the number does not drift as the demo ages.
    select max(order_date) as as_of_date
    from sales

),

latest_snapshot as (

    select max(snapshot_date) as latest_snapshot_date
    from snapshots

),

last_sale as (

    -- Only positive quantities count. A credit note is a customer sending stock back, which
    -- is the opposite of evidence that the line is still selling.
    select
        sku,
        max(order_date) as last_sale_date,
        sum(quantity) as lifetime_units_sold,
    from sales
    where quantity > 0
    group by 1

),

current_stock as (

    select s.*
    from snapshots s
    cross join latest_snapshot l
    where s.snapshot_date = l.latest_snapshot_date

),

assembled as (

    select
        cs.sku,
        p.product_name,
        p.brand,
        p.category,
        p.subcategory,
        p.status,
        p.is_discontinued,
        cs.warehouse_code,
        w.warehouse_name,
        w.region as warehouse_region,
        cs.snapshot_date,
        a.as_of_date,
        cs.units_on_hand,
        cs.units_in_transit,
        p.unit_cost_zar,
        p.list_price_zar,
        cs.stock_value_zar,
        cs.avg_weekly_demand_units,
        cs.weeks_cover,
        ls.last_sale_date,
        ls.lifetime_units_sold,
        date_diff('day', ls.last_sale_date, a.as_of_date) as days_since_last_sale,
        ls.last_sale_date is not null as has_ever_sold,
    from current_stock cs
    cross join as_of a
    left join products p
        on cs.sku = p.sku
    left join warehouses w
        on cs.warehouse_code = w.warehouse_code
    left join last_sale ls
        on cs.sku = ls.sku

),

final as (

    select
        sku,
        product_name,
        brand,
        category,
        subcategory,
        status,
        is_discontinued,
        warehouse_code,
        warehouse_name,
        warehouse_region,
        snapshot_date,
        as_of_date,
        units_on_hand,
        units_in_transit,
        unit_cost_zar,
        list_price_zar,
        stock_value_zar,
        avg_weekly_demand_units,
        weeks_cover,
        last_sale_date,
        days_since_last_sale,
        has_ever_sold,
        lifetime_units_sold,
        -- Dead means: there is physical stock, and nobody has bought the line in six months.
        -- Six months is the trade's own convention for FMCG - anything that has not moved in
        -- two quarters is not coming back on its own.
        units_on_hand > 0
            and (not has_ever_sold or days_since_last_sale > 180) as is_dead_stock,
        case
            when units_on_hand <= 0 then null
            when not has_ever_sold then 'Never sold'
            when days_since_last_sale > 180 and is_discontinued then 'Discontinued and no sale in 180+ days'
            when days_since_last_sale > 180 then 'No sale in 180+ days'
            else null
        end as dead_stock_reason,
        -- What could be released by clearing the line, at the price Meridian paid for it.
        case
            when units_on_hand > 0 and (not has_ever_sold or days_since_last_sale > 180)
                then stock_value_zar
            else 0
        end as dead_stock_value_zar,
    from assembled

)

select * from final
