-- One row per vehicle, with the depot it books on at and whether it is a line-haul unit.

with final as (

    select
        v.vehicle_id,
        v.registration,
        v.registration_raw,
        v.vehicle_class,
        v.capacity_kg,
        v.capacity_m3,
        v.depot_code,
        d.depot_name,
        d.city as depot_city,
        v.acquired_date,
        v.status,
        -- Heavy units run the corridors. They carry the kilometres, the fuel bill, and
        -- every finding that turns on cost per kilometre.
        v.vehicle_class in ('Superlink 34t', 'Tri-axle 24t') as is_heavy,
    from {{ ref('sl_vehicles') }} v
    left join {{ ref('sl_depots') }} d on v.depot_code = d.depot_code

)

select * from final
