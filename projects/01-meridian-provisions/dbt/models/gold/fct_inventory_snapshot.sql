-- fct_inventory_snapshot
--
-- One row per stock count: a SKU, at a distribution centre, on a snapshot date. Stock is
-- counted twice a week (Mondays and Thursdays), so this is a point-in-time picture, not a
-- running balance.
--
-- The two derived measures are what turn a stock list into a management report: what the
-- stock is worth, and how many weeks of selling it represents.

with snapshots as (

    select * from {{ ref('sl_inventory_snapshots') }}

),

products as (

    select * from {{ ref('dim_product') }}

),

sales as (

    select * from {{ ref('fct_sales_line') }}

),

period as (

    -- Demand is expressed as a simple flat average over the whole window, so the length of
    -- that window has to be measured once and reused.
    select
        greatest((date_diff('day', min(order_date), max(order_date)) + 1) / 7.0, 1) as weeks_in_period,
    from sales

),

weekly_demand as (

    -- Units actually shipped out of each DC for each SKU, net of returns, turned into a
    -- per-week rate. greatest(..., 0) stops a SKU that was net returned over the window from
    -- producing a negative demand rate and therefore a nonsense cover figure.
    select
        s.warehouse_code,
        s.sku,
        greatest(sum(s.quantity), 0) / p.weeks_in_period as avg_weekly_demand_units,
    from sales s
    cross join period p
    group by
        s.warehouse_code,
        s.sku,
        p.weeks_in_period

),

final as (

    select
        sn.snapshot_date,
        sn.warehouse_code,
        sn.sku,
        sn.units_on_hand,
        sn.units_in_transit,
        -- Stock is valued at what Meridian paid for it, not at what it might sell for.
        sn.units_on_hand * coalesce(pr.unit_cost_zar, 0.0) as stock_value_zar,
        sn.units_on_hand = 0 as is_stockout,
        coalesce(d.avg_weekly_demand_units, 0.0) as avg_weekly_demand_units,
        -- Weeks of cover. Null where the SKU has no demand at that DC at all, because
        -- "infinite cover" is a more honest answer than a very large number.
        sn.units_on_hand / nullif(d.avg_weekly_demand_units, 0) as weeks_cover,
    from snapshots sn
    left join products pr
        on sn.sku = pr.sku
    left join weekly_demand d
        on sn.sku = d.sku
        and sn.warehouse_code = d.warehouse_code

)

select * from final
