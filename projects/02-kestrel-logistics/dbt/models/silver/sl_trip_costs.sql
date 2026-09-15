-- Silver: the finance export. Driver hours, tolls and the fixed cost apportioned to a trip.
--
-- Fuel is deliberately absent here. It arrives from the fuel card provider on its own file
-- and against a vehicle rather than a trip, which is exactly why nobody at Kestrel has a
-- single number for what a trip costs.

with final as (

    select
        {{ clean_text('trip_id') }} as trip_id,
        try_cast(driver_hours as double) as driver_hours,
        {{ parse_decimal('driver_cost_zar') }} as driver_cost_zar,
        {{ parse_decimal('toll_cost_zar') }} as toll_cost_zar,
        {{ parse_decimal('fixed_cost_zar') }} as fixed_cost_zar,
    from {{ ref('br_trip_costs') }}

)

select * from final
