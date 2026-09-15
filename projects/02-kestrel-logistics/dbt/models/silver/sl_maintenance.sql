-- Silver: workshop jobs. Cost and the hours the vehicle was off the road.

with final as (

    select
        {{ clean_text('maintenance_id') }} as maintenance_id,
        {{ clean_text('vehicle_id') }} as vehicle_id,
        {{ parse_mixed_date('job_date') }} as job_date,
        {{ clean_text('job_type') }} as job_type,
        {{ parse_decimal('cost_zar') }} as cost_zar,
        try_cast(downtime_hours as double) as downtime_hours,
        try_cast(odometer_km as bigint) as odometer_km,
    from {{ ref('br_maintenance') }}

)

select * from final
