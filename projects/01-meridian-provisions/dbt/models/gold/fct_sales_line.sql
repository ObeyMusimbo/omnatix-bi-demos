-- fct_sales_line
--
-- The central fact table. One row per order line, with every money measure the business
-- argues about carried on the row so that nothing has to be recomputed downstream.
--
-- The important piece of work here is pushing the three order-level costs (freight, handling
-- and customer rebate) down onto the individual lines. Meridian's current reporting stops at
-- gross profit, which is why a range can look healthy and still destroy value: the costs that
-- kill it are booked on the order header where nobody attributes them to a product.

with orders as (

    -- Cancelled orders were never picked, never shipped and never invoiced, so they are not
    -- trade. Returns are a different matter and are kept - see below.
    select * from {{ ref('sl_orders') }}
    where not is_cancelled

),

order_lines as (

    select * from {{ ref('sl_order_lines') }}

),

cost_allocations as (

    select * from {{ ref('sl_cost_allocations') }}

),

products as (

    select * from {{ ref('dim_product') }}

),

customers as (

    select * from {{ ref('dim_customer') }}

),

lines_enriched as (

    select
        ol.order_line_id,
        ol.order_id,
        o.order_date,
        ol.sku,
        o.customer_id,
        o.warehouse_code,
        o.rep_id,
        -- A missing customer or product would otherwise drop the line out of every
        -- group-by. Labelling it keeps the money visible and the gap obvious.
        coalesce(c.channel, 'Unknown') as channel,
        coalesce(c.region, 'Unknown') as region,
        coalesce(p.brand, 'Unknown brand') as brand,
        coalesce(p.category, 'Unknown category') as category,
        coalesce(p.subcategory, 'Unknown subcategory') as subcategory,
        coalesce(p.product_name, 'Unknown product (' || ol.sku || ')') as product_name,
        ol.quantity,
        ol.unit_price_zar,
        ol.discount_pct,
        ol.promo_id,
        ol.promo_id is not null as is_on_promo,
        ol.is_return,
        ol.sku_is_known,
        -- A small number of lines quote a SKU that is absent from the product master. Those
        -- lines genuinely have no weight and no cost, so both are forced to zero rather than
        -- left null: a null here would silently null out every sum the line lands in. The
        -- consequence is deliberate and stated - an unknown SKU carries no COGS and draws no
        -- freight, and sku_is_known flags exactly which rows that applies to.
        coalesce(p.weight_kg, 0.0) as weight_kg,
        coalesce(p.unit_cost_zar, 0.0) as unit_cost_zar,
        -- Value of the line before any discount was applied.
        ol.quantity * ol.unit_price_zar as gross_value_zar,
        -- Invoiced value of the line, after discount. Negative on a return.
        ol.line_revenue_zar as revenue_zar,
        -- Weight uses absolute quantity: a return still occupied a pallet on the way back.
        abs(ol.quantity) * coalesce(p.weight_kg, 0.0) as line_weight_kg,
    from order_lines ol
    inner join orders o
        on ol.order_id = o.order_id
    left join products p
        on ol.sku = p.sku
    left join customers c
        on o.customer_id = c.customer_id

),

order_totals as (

    -- The three allocation denominators, computed once per order. Every one of them is
    -- guarded with nullif() downstream, because a single-line order of an unknown SKU has
    -- zero weight and a fully credited order can net to zero revenue.
    select
        order_id,
        sum(line_weight_kg) as order_weight_kg,
        count(*) as order_line_count,
        sum(abs(revenue_zar)) as order_abs_revenue_zar,
    from lines_enriched
    group by 1

),

allocated as (

    select
        l.*,

        -- FREIGHT follows WEIGHT. Trucking is paid by the kilogram, not by the rand, so a
        -- line's fair share of the delivery is its share of the kilograms on that order.
        -- This is the single allocation that exposes finding 1: bulk bottled water is a
        -- modest share of revenue and an enormous share of the load, so a revenue-based
        -- split (which is what most reporting does by default) hides the cost entirely.
        coalesce(ca.freight_cost_zar, 0.0)
            * coalesce(l.line_weight_kg / nullif(t.order_weight_kg, 0), 0) as allocated_freight_zar,

        -- HANDLING follows LINE COUNT. Picking, packing and checking cost roughly the same
        -- per line regardless of what is on it, so the order's handling splits evenly across
        -- however many lines it had.
        coalesce(ca.handling_cost_zar, 0.0)
            * coalesce(1.0 / nullif(t.order_line_count, 0), 0) as allocated_handling_zar,

        -- REBATE follows REVENUE. A volume rebate is earned on what the customer spends, so
        -- each line carries rebate in proportion to what it billed. Absolute revenue is used
        -- in the denominator so that a credit note cannot collapse it toward zero and blow
        -- the share up; because a return reverses every line on its own order, the allocated
        -- rebate keeps the same sign as the order's rebate.
        coalesce(ca.rebate_amount_zar, 0.0)
            * coalesce(abs(l.revenue_zar) / nullif(t.order_abs_revenue_zar, 0), 0) as allocated_rebate_zar,

    from lines_enriched l
    inner join order_totals t
        on l.order_id = t.order_id
    left join cost_allocations ca
        on l.order_id = ca.order_id

),

final as (

    select
        order_line_id,
        order_id,
        order_date,
        sku,
        customer_id,
        warehouse_code,
        rep_id,
        channel,
        region,
        brand,
        category,
        subcategory,
        product_name,
        quantity,
        unit_price_zar,
        discount_pct,
        gross_value_zar,
        gross_value_zar - revenue_zar as discount_value_zar,
        revenue_zar,
        unit_cost_zar,
        quantity * unit_cost_zar as cogs_zar,
        revenue_zar - (quantity * unit_cost_zar) as gross_profit_zar,
        line_weight_kg,
        allocated_freight_zar,
        allocated_handling_zar,
        allocated_rebate_zar,
        -- Contribution is what the line is actually worth to Meridian once the cost of
        -- getting it to the customer and the money handed back to the customer are both
        -- charged against it. This is the number the business does not currently have.
        (revenue_zar - (quantity * unit_cost_zar))
            - allocated_freight_zar
            - allocated_handling_zar
            - allocated_rebate_zar as contribution_zar,
        promo_id,
        is_on_promo,
        is_return,
        sku_is_known,
    from allocated

)

select * from final
