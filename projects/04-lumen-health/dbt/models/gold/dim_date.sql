-- The operating calendar, one row per day whether or not a room was open.
--
-- Carries the weekday label the utilisation grid is drawn on. The clinics do not open on a
-- Sunday, so Sunday exists here and is simply empty everywhere downstream, which is the
-- correct behaviour: a calendar that quietly omits the days with no activity cannot tell you
-- that a day had none.

with bounds as (
    select
        min(scheduled_date) as first_day,
        date '{{ var("period_end") }}' as last_day,
    from {{ ref('sl_appointments') }}
),

spine as (
    select unnest(generate_series(
        (select first_day from bounds),
        (select last_day from bounds),
        interval 1 day
    ))::date as date_day
),

final as (
    select
        date_day,
        date_trunc('month', date_day)::date as month_start,
        extract(year from date_day)::integer as year_number,
        extract(isodow from date_day)::integer as day_of_week,
        strftime(date_day, '%A') as day_name,
        strftime(date_day, '%a') as day_short,
        extract(isodow from date_day) >= 6 as is_weekend,
        strftime(date_day, '%b %Y') as month_label,
    from spine
)

select * from final order by date_day
