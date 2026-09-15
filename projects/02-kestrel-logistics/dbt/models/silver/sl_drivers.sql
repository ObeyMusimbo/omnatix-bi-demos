-- Silver: drivers and the hub they book on at.

with final as (

    select
        {{ clean_text('driver_id') }} as driver_id,
        {{ clean_text('driver_name') }} as driver_name,
        {{ clean_text('depot_code') }} as depot_code,
        {{ clean_text('licence_code') }} as licence_code,
        {{ parse_mixed_date('hired_date') }} as hired_date,
    from {{ ref('br_drivers') }}

)

select * from final
