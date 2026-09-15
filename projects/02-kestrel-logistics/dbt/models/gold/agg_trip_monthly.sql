-- Monthly trading summary, small enough to ship to a browser whole.

with final as (

    select
        month_start_date,
        strftime(month_start_date, '%Y-%m') as year_month,
        lane_type,
        vehicle_class,
        origin_depot_name,
        count(*) as trips,
        count(*) filter (where is_empty) as empty_trips,
        sum(distance_km) as distance_km,
        sum(distance_km) filter (where is_empty) as empty_distance_km,
        round(sum(distance_km) filter (where is_empty) * 100.0 / nullif(sum(distance_km), 0), 2) as empty_km_pct,
        round(sum(revenue_zar), 2) as revenue_zar,
        round(sum(fuel_cost_zar), 2) as fuel_cost_zar,
        round(sum(total_cost_zar), 2) as total_cost_zar,
        round(sum(contribution_zar), 2) as contribution_zar,
        round(sum(total_cost_zar) / nullif(sum(distance_km), 0), 3) as cost_per_km_zar,
        round(sum(revenue_zar) / nullif(sum(distance_km), 0), 3) as revenue_per_km_zar,
        round(avg(weight_utilisation_pct) filter (where not is_empty), 2) as avg_weight_utilisation_pct,
        round(avg(volume_utilisation_pct) filter (where not is_empty), 2) as avg_volume_utilisation_pct,
    from {{ ref('fct_trip') }}
    group by 1, 2, 3, 4, 5

)

select * from final
