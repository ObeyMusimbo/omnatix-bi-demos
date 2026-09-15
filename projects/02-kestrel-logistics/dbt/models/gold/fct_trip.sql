-- fct_trip
--
-- One row per vehicle movement, and the first place in Kestrel's world where the full cost of
-- a trip exists as a single number. Until here it is scattered: driver hours and tolls sit in
-- the finance export, fuel arrives from the card provider against a vehicle rather than a
-- trip, and workshop spend lands against a vehicle with no reference to the work it was doing.
--
-- Empty legs are kept. A truck coming home with nothing still burns diesel, still pays a
-- driver and still pays tolls, and charging that cost back to the load that caused the trip
-- is the whole of finding 1.

with trips as (

    select * from {{ ref('sl_trips') }}

),

fuel as (

    select
        vehicle_id,
        txn_datetime,
        litres,
        cost_zar,
    from {{ ref('sl_fuel_transactions') }}

),

-- A trip takes on the fuel draw that vehicle made most recently at or before it arrived.
-- ASOF is the right join here: an equality join has nothing to match on, and a range join
-- would fan out whenever a vehicle fuelled twice in a window.
trips_fuelled as (

    select
        trips.*,
        fuel.litres as fuel_litres_raw,
        fuel.cost_zar as fuel_cost_raw,
        fuel.txn_datetime as fuel_txn_datetime,
    from trips
    asof left join fuel
        on trips.vehicle_id = fuel.vehicle_id
       and fuel.txn_datetime <= trips.actual_arrive

),

-- Workshop spend belongs to the kilometres that wore the vehicle out, not to the day the
-- invoice happened to land. Each vehicle's monthly bill is spread across the distance that
-- vehicle covered in the same month.
vehicle_month_km as (

    select
        vehicle_id,
        date_trunc('month', trip_date)::date as month_start_date,
        sum(distance_km) as month_km,
    from trips
    group by 1, 2

),

vehicle_month_maintenance as (

    select
        vehicle_id,
        date_trunc('month', job_date)::date as month_start_date,
        sum(cost_zar) as month_maintenance_zar,
    from {{ ref('sl_maintenance') }}
    group by 1, 2

),

trip_revenue as (

    select
        trip_id,
        sum(revenue_zar) as revenue_zar,
        count(*) as consignment_count,
        count(*) filter (where is_failed) as failed_count,
    from {{ ref('sl_consignments') }}
    where trip_is_known
    group by 1

),

joined as (

    select
        t.trip_id,
        t.trip_date,
        date_trunc('month', t.trip_date)::date as month_start_date,
        t.lane_id,
        l.lane_name,
        l.lane_type,
        t.direction,
        t.origin_depot_code,
        l.origin_depot_name,
        t.vehicle_id,
        v.vehicle_class,
        v.is_heavy,
        t.driver_id,
        t.distance_km,
        t.is_empty,
        t.distance_is_estimated,
        t.load_kg,
        t.load_m3,
        v.capacity_kg,
        v.capacity_m3,
        t.actual_depart,
        t.actual_arrive,
        t.actual_hours,
        t.arrive_delay_hours,

        -- Only count a fuel draw as this trip's if it happened during the trip. Otherwise the
        -- vehicle's previous fill would be charged to a trip it had nothing to do with.
        case when t.fuel_txn_datetime >= t.actual_depart - interval 2 hour
             then t.fuel_litres_raw end as fuel_litres,
        case when t.fuel_txn_datetime >= t.actual_depart - interval 2 hour
             then t.fuel_cost_raw end as fuel_cost_zar,

        c.driver_cost_zar,
        c.toll_cost_zar,
        c.fixed_cost_zar,
        coalesce(
            m.month_maintenance_zar * t.distance_km / nullif(km.month_km, 0),
            0
        ) as maintenance_cost_zar,

        coalesce(r.revenue_zar, 0) as revenue_zar,
        coalesce(r.consignment_count, 0) as consignment_count,
        coalesce(r.failed_count, 0) as failed_count,
    from trips_fuelled t
    left join {{ ref('dim_lane') }} l on t.lane_id = l.lane_id
    left join {{ ref('dim_vehicle') }} v on t.vehicle_id = v.vehicle_id
    left join {{ ref('sl_trip_costs') }} c on t.trip_id = c.trip_id
    left join vehicle_month_km km
        on t.vehicle_id = km.vehicle_id
       and date_trunc('month', t.trip_date)::date = km.month_start_date
    left join vehicle_month_maintenance m
        on t.vehicle_id = m.vehicle_id
       and date_trunc('month', t.trip_date)::date = m.month_start_date
    left join trip_revenue r on t.trip_id = r.trip_id

),

final as (

    select
        trip_id,
        trip_date,
        month_start_date,
        lane_id,
        lane_name,
        lane_type,
        direction,
        origin_depot_code,
        origin_depot_name,
        vehicle_id,
        vehicle_class,
        is_heavy,
        driver_id,
        distance_km,
        is_empty,
        distance_is_estimated,
        load_kg,
        load_m3,
        capacity_kg,
        capacity_m3,

        -- Utilisation on both axes. A load can fill the deck and never reach the axle limit,
        -- which is finding 5: the truck is full of air, and it is paid for by weight.
        case when is_empty then 0
             else round(load_kg * 100.0 / nullif(capacity_kg, 0), 2) end as weight_utilisation_pct,
        case when is_empty then 0
             else round(load_m3 * 100.0 / nullif(capacity_m3, 0), 2) end as volume_utilisation_pct,

        coalesce(fuel_litres, 0) as fuel_litres,
        coalesce(fuel_cost_zar, 0) as fuel_cost_zar,
        coalesce(driver_cost_zar, 0) as driver_cost_zar,
        coalesce(toll_cost_zar, 0) as toll_cost_zar,
        coalesce(fixed_cost_zar, 0) as fixed_cost_zar,
        round(maintenance_cost_zar, 2) as maintenance_cost_zar,

        round(
            coalesce(fuel_cost_zar, 0)
            + coalesce(driver_cost_zar, 0)
            + coalesce(toll_cost_zar, 0)
            + coalesce(fixed_cost_zar, 0)
            + maintenance_cost_zar
        , 2) as total_cost_zar,

        revenue_zar,
        consignment_count,
        failed_count,

        round(revenue_zar - (
            coalesce(fuel_cost_zar, 0)
            + coalesce(driver_cost_zar, 0)
            + coalesce(toll_cost_zar, 0)
            + coalesce(fixed_cost_zar, 0)
            + maintenance_cost_zar
        ), 2) as contribution_zar,

        round((
            coalesce(fuel_cost_zar, 0)
            + coalesce(driver_cost_zar, 0)
            + coalesce(toll_cost_zar, 0)
            + coalesce(fixed_cost_zar, 0)
            + maintenance_cost_zar
        ) / nullif(distance_km, 0), 2) as cost_per_km_zar,
        round(revenue_zar / nullif(distance_km, 0), 2) as revenue_per_km_zar,
        round(coalesce(fuel_litres, 0) * 100.0 / nullif(distance_km, 0), 2) as litres_per_100km,

        actual_depart,
        actual_arrive,
        actual_hours,
        arrive_delay_hours,
        coalesce(arrive_delay_hours > 2, false) as is_late,
    from joined

)

select * from final
