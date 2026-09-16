-- The signature view: the consulting week as a grid of weekday against hour.
--
-- Each cell carries three things that have to be read together, which is why they live in
-- one model rather than three charts. How much capacity was offered. How much of it was
-- taken. And how long the patients who did come had to wait, because a cell at ninety per
-- cent with a thirty minute wait and a cell at twenty per cent are the same practice on two
-- different mornings.
--
-- Saturday runs a short morning list and no afternoon, so the afternoon cells do not exist
-- rather than reading as empty. Sunday is closed and does not appear at all.

with cells as (

    select
        day_of_week,
        slot_hour,
        sum(slots_offered) as slots_offered,
        sum(slots_booked) as slots_booked,
        sum(slots_attended) as slots_attended,
        sum(slots_no_show) as slots_no_show,
        sum(slots_unfilled) as slots_unfilled,
        sum(capacity_cost_zar) as capacity_cost_zar,
        sum(capacity_cost_zar) / nullif(sum(slots_offered), 0) as cost_per_slot_zar,
    from {{ ref('fct_capacity_hour') }}
    group by all

),

waits as (

    select
        day_of_week,
        slot_hour,
        avg(wait_minutes) as avg_wait_minutes,
        quantile_cont(wait_minutes, 0.9) as p90_wait_minutes,
        avg(booking_lead_days) as avg_booking_lead_days,
    from {{ ref('sl_appointments') }}
    where is_attended
    group by all

),

final as (

    select
        c.day_of_week,
        d.day_short,
        d.day_name,
        c.slot_hour,
        lpad(c.slot_hour::varchar, 2, '0') || ':00' as slot_label,
        c.slots_offered,
        c.slots_booked,
        c.slots_attended,
        c.slots_no_show,
        c.slots_unfilled,
        round(c.capacity_cost_zar, 2) as capacity_cost_zar,
        round(c.cost_per_slot_zar, 2) as cost_per_slot_zar,
        round(c.slots_unfilled * c.cost_per_slot_zar, 2) as unfilled_cost_zar,
        round(c.slots_booked::double / nullif(c.slots_offered, 0) * 100, 1) as fill_pct,
        round(c.slots_attended::double / nullif(c.slots_offered, 0) * 100, 1) as attended_pct,
        round(c.slots_no_show::double / nullif(c.slots_booked, 0) * 100, 1) as no_show_pct,
        round(w.avg_wait_minutes, 1) as avg_wait_minutes,
        round(w.p90_wait_minutes, 1) as p90_wait_minutes,
        round(w.avg_booking_lead_days, 1) as avg_booking_lead_days,
    from cells c
    left join waits w using (day_of_week, slot_hour)
    left join (select distinct day_of_week, day_short, day_name from {{ ref('dim_date') }}) d
        using (day_of_week)

)

select * from final order by day_of_week, slot_hour
