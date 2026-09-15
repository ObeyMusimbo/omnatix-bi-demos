-- One row per lane, carrying both ends of the line so the dashboard can draw it on a map.

with final as (

    select
        l.lane_id,
        l.lane_name,
        l.lane_type,
        l.origin_depot_code,
        d.depot_name as origin_depot_name,
        d.city as origin_city,
        d.latitude as origin_lat,
        d.longitude as origin_lon,
        l.destination_city,
        l.destination_lat,
        l.destination_lon,
        l.distance_km,
        l.toll_cost_zar,
        l.planned_hours,
        -- What the rate card assumed the return leg would sell. The same number on every
        -- lane, which is the root of finding 1.
        l.assumed_backhaul_pct,
        l.lane_type = 'Line-haul' as is_linehaul,
    from {{ ref('sl_lanes') }} l
    left join {{ ref('sl_depots') }} d on l.origin_depot_code = d.depot_code

)

select * from final
