-- Finding 5: paying to move air.
--
-- Freight is billed by weight but a trailer runs out of deck space long before it runs out
-- of axle allowance on light, bulky cargo. Where volume utilisation is high and weight
-- utilisation is not, the truck is full and the invoice is small.

with laden as (

    select * from {{ ref('fct_trip') }}
    where not is_empty
      and distance_km > 0

),

final as (

    select
        vehicle_class,
        lane_type,
        lane_name,
        count(*) as trips,
        sum(distance_km) as distance_km,
        round(avg(weight_utilisation_pct), 2) as avg_weight_utilisation_pct,
        round(avg(volume_utilisation_pct), 2) as avg_volume_utilisation_pct,
        round(avg(volume_utilisation_pct) - avg(weight_utilisation_pct), 2) as utilisation_gap_pts,
        round(sum(revenue_zar), 2) as revenue_zar,
        round(sum(total_cost_zar), 2) as total_cost_zar,
        round(sum(contribution_zar), 2) as contribution_zar,
        round(sum(revenue_zar) / nullif(sum(distance_km), 0), 2) as revenue_per_km_zar,
        -- The revenue the same kilometres would have earned at the weight utilisation the
        -- rest of this class manages. Not money on the table today, but the size of the prize
        -- from consolidating these loads onto fewer, fuller trucks.
        count(*) filter (where volume_utilisation_pct > 85 and weight_utilisation_pct < 55) as air_trips,
        round(sum(case when volume_utilisation_pct > 85 and weight_utilisation_pct < 55
                       then total_cost_zar else 0 end), 2) as air_trip_cost_zar,
    from laden
    group by 1, 2, 3

)

select * from final
