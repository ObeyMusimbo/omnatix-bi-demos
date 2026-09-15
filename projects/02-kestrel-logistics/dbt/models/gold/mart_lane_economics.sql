-- Finding 1: lanes that fund their own empty return.
--
-- Grain: lane x period. Carries both ends of the line so the dashboard can draw the network
-- on a map with each corridor coloured by what it actually contributes.
--
-- The column that matters is the pair: outbound_only_contribution_zar is what Kestrel's
-- current reporting shows, contribution_zar is the truth once the return leg the outbound
-- caused is charged to it.

with periods as (

    select
        lane_id,
        lane_name,
        case when trip_date > date '{{ var("period_end") }}'::date - interval 365 day
             then 'Trailing twelve months' else 'Prior twelve months' end as period_label,
        case when trip_date > date '{{ var("period_end") }}'::date - interval 365 day
             then 1 else 2 end as period_order,
        count(*) as round_trips,
        count(*) filter (where return_was_empty) as empty_returns,
        sum(total_distance_km) as distance_km,
        sum(total_revenue_zar) as revenue_zar,
        sum(total_cost_zar) as cost_zar,
        sum(contribution_zar) as contribution_zar,
        sum(outbound_only_contribution_zar) as outbound_only_contribution_zar,
        sum(return_cost_zar) filter (where return_was_empty) as empty_return_cost_zar,
        avg(outbound_weight_utilisation_pct) as avg_weight_utilisation_pct,
    from {{ ref('fct_round_trip') }}
    where trip_date > date '{{ var("period_end") }}'::date - interval 730 day
    group by 1, 2, 3, 4

),

final as (

    select
        p.lane_id,
        p.lane_name,
        p.period_label,
        p.period_order,
        l.lane_type,
        l.origin_depot_code,
        l.origin_depot_name,
        l.origin_city,
        l.origin_lat,
        l.origin_lon,
        l.destination_city,
        l.destination_lat,
        l.destination_lon,
        l.distance_km as lane_distance_km,

        p.round_trips,
        p.empty_returns,
        p.distance_km,
        round(p.revenue_zar, 2) as revenue_zar,
        round(p.cost_zar, 2) as cost_zar,
        round(p.contribution_zar, 2) as contribution_zar,
        round(p.outbound_only_contribution_zar, 2) as outbound_only_contribution_zar,
        round(coalesce(p.empty_return_cost_zar, 0), 2) as empty_return_cost_zar,

        -- What the rate card assumed, against what the lane actually achieves. The gap
        -- between these two numbers is the reason the corridor loses money.
        l.assumed_backhaul_pct,
        round((1 - p.empty_returns * 1.0 / nullif(p.round_trips, 0)) * 100, 1) as actual_backhaul_pct,
        round(l.assumed_backhaul_pct
              - (1 - p.empty_returns * 1.0 / nullif(p.round_trips, 0)) * 100, 1) as backhaul_shortfall_pts,

        round(p.contribution_zar / nullif(p.revenue_zar, 0) * 100, 2) as contribution_margin_pct,
        round(p.contribution_zar / nullif(p.distance_km, 0), 2) as contribution_per_km_zar,
        round(p.avg_weight_utilisation_pct, 2) as avg_weight_utilisation_pct,

        -- Looks profitable one way, loses money as a round trip. This is the flag the map
        -- colours on and the demo opens with.
        p.outbound_only_contribution_zar > 0 and p.contribution_zar < 0 as is_backhaul_trap,
        p.contribution_zar < 0 as is_loss_making,
    from periods p
    left join {{ ref('dim_lane') }} l on p.lane_id = l.lane_id

)

select * from final
