-- Silver: the fleet.
--
-- Resolves defect 2: the same physical vehicle is captured three ways across the TMS, the
-- fuel card file and the workshop system. 'CA 123-456', 'ca123456', and with leading spaces.
-- vehicle_id is reliable, but registration is what a depot manager reads off a windscreen,
-- so it has to resolve to one canonical form or the fleet list shows phantom trucks.

with source as (

    select * from {{ ref('br_vehicles') }}

),

final as (

    select
        {{ clean_text('vehicle_id') }} as vehicle_id,
        -- Defect 2: punctuation stripped and uppercased, so all three spellings collapse.
        {{ normalise_registration('registration') }} as registration,
        -- Kept alongside so an operator can still find the row by whatever they typed.
        {{ clean_text('registration') }} as registration_raw,
        {{ clean_text('vehicle_class') }} as vehicle_class,
        try_cast(capacity_kg as integer) as capacity_kg,
        try_cast(capacity_m3 as double) as capacity_m3,
        {{ clean_text('depot_code') }} as depot_code,
        {{ parse_mixed_date('acquired_date') }} as acquired_date,
        {{ clean_text('status') }} as status,
    from source

)

select * from final
