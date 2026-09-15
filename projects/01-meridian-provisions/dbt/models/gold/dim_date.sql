-- dim_date
--
-- One row per calendar day across the whole window the business has data for. The calendar
-- is generated from the data rather than hardcoded, so it can never end up shorter than the
-- facts that join to it.

with order_bounds as (

    select
        min(order_date) as first_event_day,
        max(order_date) as last_event_day,
    from {{ ref('sl_orders') }}

),

snapshot_bounds as (

    -- Stock is captured on its own cadence (Mondays and Thursdays). Folding it into the
    -- bounds guarantees every fct_inventory_snapshot row finds a calendar day to join to.
    select
        min(snapshot_date) as first_event_day,
        max(snapshot_date) as last_event_day,
    from {{ ref('sl_inventory_snapshots') }}

),

window_edges as (

    -- Padded out to whole months so month-level charts never open or close on a stub month.
    select
        date_trunc('month', least(o.first_event_day, s.first_event_day))::date as range_start,
        (date_trunc('month', greatest(o.last_event_day, s.last_event_day)) + interval 1 month - interval 1 day)::date as range_end,
    from order_bounds o
    cross join snapshot_bounds s

),

spine as (

    select
        unnest(generate_series(range_start, range_end, interval 1 day))::date as date_day,
    from window_edges

),

final as (

    select
        date_day,
        year(date_day) as year,
        month(date_day) as month_num,
        monthname(date_day) as month_name,
        left(monthname(date_day), 3) as month_short,
        strftime(date_day, '%Y-%m') as year_month,
        quarter(date_day) as quarter,
        -- ISO day numbering: 1 = Monday through 7 = Sunday. Thursday is 4 and Friday and
        -- Saturday are 5 and 6, which is exactly what the weekend stock-out analysis keys off.
        isodow(date_day) as day_of_week,
        dayname(date_day) as day_name,
        isodow(date_day) in (6, 7) as is_weekend,
        date_day = last_day(date_day) as is_month_end,
    from spine

)

select * from final
