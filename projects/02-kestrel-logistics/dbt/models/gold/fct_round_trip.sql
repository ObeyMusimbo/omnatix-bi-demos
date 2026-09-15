-- fct_round_trip
--
-- The model finding 1 turns on.
--
-- Kestrel's rate card prices a lane one way. Operationally there is no such thing: a truck
-- sent from Johannesburg to Gqeberha has to come back, and whether or not anything is loaded
-- on it for the return, the diesel, the driver and the tolls are all spent. Every leg has
-- looked profitable in isolation for years because the outbound is measured on its own and
-- the empty return is charged to nobody.
--
-- Pairing an outbound with the return it caused, and charging both legs against the revenue
-- they jointly earned, is what makes the loss visible. That single join is the finding.
--
-- Legs are matched by lane and by order of departure. The dispatch system releases a return
-- for each outbound on a lane in sequence, so the nth outbound on a lane belongs with the nth
-- return. Matching on time windows instead would fail on the long corridors, where a return
-- can leave three days after the outbound it belongs to and after later outbounds have gone.

with linehaul as (

    select * from {{ ref('fct_trip') }}
    where lane_type = 'Line-haul'

),

outbound as (

    select
        *,
        row_number() over (partition by lane_id order by actual_depart, trip_id) as leg_seq,
    from linehaul
    where direction = 'Outbound'

),

returns as (

    select
        *,
        row_number() over (partition by lane_id order by actual_depart, trip_id) as leg_seq,
    from linehaul
    where direction = 'Return'

),

paired as (

    select
        o.trip_id as outbound_trip_id,
        r.trip_id as return_trip_id,
        o.lane_id,
        o.lane_name,
        o.origin_depot_code,
        o.origin_depot_name,
        o.trip_date,
        o.month_start_date,
        o.vehicle_class,

        o.revenue_zar as outbound_revenue_zar,
        coalesce(r.revenue_zar, 0) as return_revenue_zar,
        o.total_cost_zar as outbound_cost_zar,
        coalesce(r.total_cost_zar, 0) as return_cost_zar,
        o.distance_km as outbound_distance_km,
        coalesce(r.distance_km, 0) as return_distance_km,

        -- A return that carried nothing. The share of these against what the tariff assumed
        -- is the whole argument.
        coalesce(r.is_empty, true) as return_was_empty,
        r.trip_id is null as return_missing,
        o.weight_utilisation_pct as outbound_weight_utilisation_pct,
    from outbound o
    left join returns r
        on o.lane_id = r.lane_id
       and o.leg_seq = r.leg_seq

),

final as (

    select
        outbound_trip_id || '/' || coalesce(return_trip_id, 'none') as round_trip_id,
        outbound_trip_id,
        return_trip_id,
        lane_id,
        lane_name,
        origin_depot_code,
        origin_depot_name,
        trip_date,
        month_start_date,
        vehicle_class,

        outbound_revenue_zar,
        return_revenue_zar,
        round(outbound_revenue_zar + return_revenue_zar, 2) as total_revenue_zar,
        outbound_cost_zar,
        return_cost_zar,
        round(outbound_cost_zar + return_cost_zar, 2) as total_cost_zar,
        round(outbound_revenue_zar + return_revenue_zar
              - outbound_cost_zar - return_cost_zar, 2) as contribution_zar,

        outbound_distance_km,
        return_distance_km,
        outbound_distance_km + return_distance_km as total_distance_km,
        return_was_empty,
        return_missing,
        outbound_weight_utilisation_pct,

        round((outbound_revenue_zar + return_revenue_zar
               - outbound_cost_zar - return_cost_zar)
              / nullif(outbound_distance_km + return_distance_km, 0), 2) as contribution_per_km_zar,
        -- What the outbound leg alone appears to earn. Shown next to the round trip figure so
        -- the gap between the two is the point of the chart.
        round(outbound_revenue_zar - outbound_cost_zar, 2) as outbound_only_contribution_zar,
    from paired

)

select * from final
