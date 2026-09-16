-- Capacity spread across the hours it is actually offered in.
--
-- A session is a block, but utilisation is a question about hours: the complaint is never
-- "Mondays are quiet", it is "nobody comes before eleven on a Monday". So the block is
-- expanded one slot at a time and each slot is placed in the hour it starts in.
--
-- The placement rule has to match the diary exactly, and the diary does not respect the
-- clock: a twenty five minute slot crosses the hour, so the fourth slot of a nine o'clock
-- session starts at 10:15. Expanding by slot index and taking the hour that index falls in
-- reproduces that. Dividing the session's slots evenly across its hours does not, and it
-- would put capacity in hours the diary never offered.

with expanded as (

    select
        s.session_id,
        s.clinic_code,
        s.practitioner_id,
        s.session_date,
        s.slot_minutes,
        s.cost_per_slot_zar,
        s.start_hour
            + (unnest(generate_series(0, s.slots_offered - 1)) * s.slot_minutes) // 60
            as slot_hour,
    from {{ ref('sl_sessions') }} s
    where s.slots_offered > 0

),

capacity as (

    select
        session_id,
        clinic_code,
        practitioner_id,
        session_date,
        slot_hour,
        count(*) as slots_offered,
        sum(cost_per_slot_zar) as capacity_cost_zar,
    from expanded
    group by all

),

demand as (

    select
        session_id,
        slot_hour,
        count(*) as slots_booked,
        count(*) filter (where is_attended) as slots_attended,
        count(*) filter (where is_no_show) as slots_no_show,
        avg(wait_minutes) filter (where is_attended) as avg_wait_minutes,
    from {{ ref('sl_appointments') }}
    group by all

),

final as (

    select
        c.session_id,
        c.clinic_code,
        c.practitioner_id,
        p.discipline,
        c.session_date,
        date_trunc('month', c.session_date)::date as session_month,
        extract(isodow from c.session_date)::integer as day_of_week,
        c.slot_hour,
        c.slots_offered,
        coalesce(d.slots_booked, 0) as slots_booked,
        coalesce(d.slots_attended, 0) as slots_attended,
        coalesce(d.slots_no_show, 0) as slots_no_show,
        c.slots_offered - coalesce(d.slots_booked, 0) as slots_unfilled,
        round(c.capacity_cost_zar, 2) as capacity_cost_zar,
        d.avg_wait_minutes,
    from capacity c
    left join demand d using (session_id, slot_hour)
    left join {{ ref('sl_practitioners') }} p using (practitioner_id)

)

select * from final
