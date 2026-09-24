-- Finding 3: the seven thirsty vehicles.
--
-- Consumption is only meaningful against like work, so each vehicle is compared with the
-- median of its own class rather than with the fleet. Excess litres are valued at the price
-- that vehicle actually paid, not at an average, because diesel moved across the window.
--
-- Trailing twelve months, the window every other step of the closing bridge counts. This mart
-- used to read the whole two years, so the bridge added two years of excess diesel to one
-- year of everything else and the page called it "a year".

with vehicle_usage as (

    select
        t.vehicle_id,
        t.vehicle_class,
        count(*) as trips,
        sum(t.distance_km) as distance_km,
        sum(t.fuel_litres) as litres,
        sum(t.fuel_cost_zar) as fuel_cost_zar,
        round(sum(t.fuel_litres) * 100.0 / nullif(sum(t.distance_km), 0), 2) as litres_per_100km,
        round(sum(t.fuel_cost_zar) / nullif(sum(t.fuel_litres), 0), 2) as avg_price_per_litre,
    from {{ ref('fct_trip') }} t
    where t.fuel_litres > 0
      and t.distance_km > 0
      and t.trip_date > date '{{ var("period_end") }}'::date - interval 365 day
    group by 1, 2

),

class_norm as (

    select
        vehicle_class,
        median(litres_per_100km) as class_median_l100,
    from vehicle_usage
    group by 1

),

final as (

    select
        u.vehicle_id,
        v.registration,
        u.vehicle_class,
        v.depot_name,
        u.trips,
        u.distance_km,
        u.litres,
        u.fuel_cost_zar,
        u.litres_per_100km,
        n.class_median_l100,
        round(u.litres_per_100km - n.class_median_l100, 2) as excess_l100,
        round((u.litres_per_100km / nullif(n.class_median_l100, 0) - 1) * 100, 1) as excess_pct,
        -- What the gap costs: the extra litres per kilometre, over the distance this vehicle
        -- actually covered, at the price it actually paid.
        round(greatest(u.litres_per_100km - n.class_median_l100, 0)
              / 100.0 * u.distance_km * u.avg_price_per_litre, 2) as excess_cost_zar,
        u.litres_per_100km > n.class_median_l100 * 1.15 as is_outlier,
    from vehicle_usage u
    join class_norm n on u.vehicle_class = n.vehicle_class
    left join {{ ref('dim_vehicle') }} v on u.vehicle_id = v.vehicle_id

)

select * from final
