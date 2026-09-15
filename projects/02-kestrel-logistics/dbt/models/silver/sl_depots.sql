-- Silver: the three hubs. Coordinates are load bearing, the dashboard map draws from them.

with final as (

    select
        {{ clean_text('depot_code') }} as depot_code,
        {{ clean_text('depot_name') }} as depot_name,
        {{ clean_text('suburb') }} as suburb,
        {{ clean_text('city') }} as city,
        {{ clean_text('province') }} as province,
        try_cast(latitude as double) as latitude,
        try_cast(longitude as double) as longitude,
    from {{ ref('br_depots') }}

)

select * from final
