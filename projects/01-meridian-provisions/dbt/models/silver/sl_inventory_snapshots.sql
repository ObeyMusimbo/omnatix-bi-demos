-- Silver: stock positions, one row per snapshot date, warehouse and SKU.
-- No planted defects here; typed so stock cover can be calculated against sales.

with source as (

    select * from {{ ref('br_inventory_snapshots') }}

),

cleaned as (

    select
        {{ parse_mixed_date('snapshot_date') }} as snapshot_date,
        {{ clean_text('warehouse_code') }} as warehouse_code,
        {{ clean_text('sku') }} as sku,
        try_cast(trim(units_on_hand::varchar) as integer) as units_on_hand,
        try_cast(trim(units_in_transit::varchar) as integer) as units_in_transit
    from source

),

final as (

    select
        snapshot_date,
        warehouse_code,
        sku,
        units_on_hand,
        units_in_transit
    from cleaned

)

select * from final
