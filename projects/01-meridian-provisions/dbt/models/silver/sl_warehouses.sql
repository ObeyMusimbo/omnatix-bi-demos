-- Silver: the three distribution centres.
-- No planted defects here; trimmed and typed so warehouse labels join cleanly to
-- orders and to the inventory snapshots.

with source as (

    select * from {{ ref('br_warehouses') }}

),

cleaned as (

    select
        {{ clean_text('warehouse_code') }} as warehouse_code,
        {{ clean_text('warehouse_name') }} as warehouse_name,
        {{ clean_text('region') }} as region
    from source

),

final as (

    select
        warehouse_code,
        warehouse_name,
        region
    from cleaned

)

select * from final
