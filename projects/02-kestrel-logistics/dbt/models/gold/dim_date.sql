-- dim_date
--
-- The operating calendar. One row per day across the whole window Kestrel has trips for,
-- whether or not a wheel turned that day. Quiet days matter here: a Sunday with no line-haul
-- has to show as a real zero rather than vanish from a daily chart.
--
-- The range is read from the trip data every time the warehouse is rebuilt, so the calendar
-- can never be shorter than the facts that join to it.

with trip_bounds as (

    select
        min(trip_date) as first_trip_day,
        max(trip_date) as last_trip_day,
    from {{ ref('sl_trips') }}

),

window_edges as (

    -- Padded out to whole months so a monthly chart never opens or closes on a stub month.
    select
        date_trunc('month', first_trip_day)::date as range_start,
        (date_trunc('month', last_trip_day) + interval 1 month - interval 1 day)::date as range_end,
    from trip_bounds

),

spine as (

    select
        unnest(generate_series(range_start, range_end, interval 1 day))::date as date_day,
    from window_edges

),

flagged as (

    select
        date_day,
        -- Business days remaining in the month, counting this day itself. Kestrel's dispatch
        -- office works Monday to Friday, so only those days count down toward the month end
        -- run. Saturday line-haul happens but nobody in the office is closing a month on it.
        sum(case when isodow(date_day) <= 5 then 1 else 0 end) over (
            partition by date_trunc('month', date_day)
            order by date_day
            rows between current row and unbounded following
        ) as business_days_remaining,
    from spine

),

final as (

    select
        date_day,
        year(date_day) as year,
        month(date_day) as month_num,
        monthname(date_day) as month_name,
        left(monthname(date_day), 3) as month_short,
        strftime(date_day, '%Y-%m') as year_month,
        date_trunc('month', date_day)::date as month_start_date,
        quarter(date_day) as quarter,
        -- ISO day numbering: 1 = Monday through 7 = Sunday. Friday is 5, which is the day the
        -- service collapse in finding 4 keys off.
        isodow(date_day) as day_of_week,
        dayname(date_day) as day_name,
        isodow(date_day) in (6, 7) as is_weekend,
        date_day = last_day(date_day) as is_month_end,
        -- One of the last two business days of the month. This is when dispatch batches
        -- everything that has been sitting all month into one run, and service falls over.
        business_days_remaining <= 2 as is_month_end_run,
        isodow(date_day) = 5 as is_friday,
        -- The single label finding 4 is charted on. A day that is both a Friday and part of
        -- the month end run is counted as month end run, because that is the harder pressure.
        case
            when business_days_remaining <= 2 then 'Month end run'
            when isodow(date_day) = 5 then 'Friday'
            else 'Normal day'
        end as dispatch_day_bucket,
    from flagged

)

select * from final
