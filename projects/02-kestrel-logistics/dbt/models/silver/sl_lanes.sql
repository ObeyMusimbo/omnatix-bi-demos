-- Silver: lanes, both line-haul corridors and metro distribution runs.
--
-- assumed_backhaul_pct is the share of the return leg the tariff was priced against. It is
-- the same figure on every lane, which is itself the problem: the rate card was built on one
-- assumption and never revisited lane by lane. Finding 1 is what that costs.

with final as (

    select
        {{ clean_text('lane_id') }} as lane_id,
        {{ clean_text('lane_name') }} as lane_name,
        {{ clean_text('lane_type') }} as lane_type,
        {{ clean_text('origin_depot_code') }} as origin_depot_code,
        {{ clean_text('destination_city') }} as destination_city,
        try_cast(destination_lat as double) as destination_lat,
        try_cast(destination_lon as double) as destination_lon,
        try_cast(distance_km as double) as distance_km,
        try_cast(toll_cost_zar as double) as toll_cost_zar,
        try_cast(planned_hours as double) as planned_hours,
        try_cast(assumed_backhaul_pct as double) as assumed_backhaul_pct,
    from {{ ref('br_lanes') }}

)

select * from final
