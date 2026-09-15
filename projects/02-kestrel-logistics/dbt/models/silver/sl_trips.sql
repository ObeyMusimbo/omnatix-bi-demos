-- Silver: one row per vehicle movement, including the empty ones.
--
-- Resolves defect 1 (two timestamp formats from two systems) and defect 7 (a GPS fault
-- leaving a handful of trips with a distance of 0 or -1).
--
-- Empty return legs are kept. They are the single most important rows in this warehouse:
-- a truck coming home with nothing still burns diesel, still pays a driver, and still pays
-- tolls, and finding 1 is entirely about charging that cost to the load that caused the trip.

with source as (

    select * from {{ ref('br_trips') }}

),

lanes as (

    select
        lane_id,
        distance_km as lane_distance_km,
    from {{ ref('sl_lanes') }}

),

parsed as (

    select
        {{ clean_text('source.trip_id') }} as trip_id,
        {{ parse_mixed_date('source.trip_date') }} as trip_date,
        {{ clean_text('source.lane_id') }} as lane_id,
        {{ clean_text('source.direction') }} as direction,
        {{ clean_text('source.vehicle_id') }} as vehicle_id,
        {{ clean_text('source.driver_id') }} as driver_id,
        {{ clean_text('source.origin_depot_code') }} as origin_depot_code,

        -- Defect 1: the TMS writes ISO, the older dispatch export writes DD/MM/YYYY HH:MM.
        -- About 28% of rows are the second format, so a naive cast loses a quarter of the day.
        {{ parse_mixed_timestamp('source.planned_depart') }} as planned_depart,
        {{ parse_mixed_timestamp('source.actual_depart') }} as actual_depart,
        {{ parse_mixed_timestamp('source.planned_arrive') }} as planned_arrive,
        {{ parse_mixed_timestamp('source.actual_arrive') }} as actual_arrive,

        -- Defect 7: a distance of zero or less is a telemetry fault, not a trip that did not
        -- move. Null it here and fall back to the lane's nominal distance below, because
        -- leaving a zero in place would quietly understate cost per kilometre for the fleet.
        case when try_cast(source.distance_km as double) > 0
             then try_cast(source.distance_km as double) end as reported_distance_km,
        lanes.lane_distance_km,

        try_cast(source.load_kg as integer) as load_kg,
        try_cast(source.load_m3 as double) as load_m3,
        upper(trim(source.is_empty::varchar)) = 'Y' as is_empty,
    from source
    left join lanes
        on {{ clean_text('source.lane_id') }} = lanes.lane_id

),

final as (

    select
        trip_id,
        trip_date,
        lane_id,
        direction,
        vehicle_id,
        driver_id,
        origin_depot_code,
        planned_depart,
        actual_depart,
        planned_arrive,
        actual_arrive,
        coalesce(reported_distance_km, lane_distance_km) as distance_km,
        reported_distance_km is null as distance_is_estimated,
        load_kg,
        load_m3,
        is_empty,
        -- How late the truck left and arrived. Both are the raw material for finding 4:
        -- on a Friday or during the month end run, dispatch batching pushes these out.
        date_diff('minute', planned_depart, actual_depart) / 60.0 as depart_delay_hours,
        date_diff('minute', planned_arrive, actual_arrive) / 60.0 as arrive_delay_hours,
        date_diff('minute', actual_depart, actual_arrive) / 60.0 as actual_hours,
    from parsed

)

select * from final
