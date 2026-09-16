-- One row per session: a practitioner in a room for a block of hours.
--
-- This is the cost side. A session is bought whole. Whether twenty patients come through it
-- or four, the same amount leaves the bank, so slots_unfilled multiplied by cost_per_slot is
-- money that was spent on nothing at all.
--
-- A no-show is counted separately from an unfilled slot on purpose. Both end with an empty
-- room, but one of them had a patient who intended to come, and only that one can be fixed
-- with a text message.

with booked as (

    select
        session_id,
        count(*) as slots_booked,
        count(*) filter (where is_attended) as slots_attended,
        count(*) filter (where is_no_show) as slots_no_show,
        count(*) filter (where status = 'Cancelled') as slots_cancelled,
        avg(wait_minutes) filter (where is_attended) as avg_wait_minutes,
    from {{ ref('sl_appointments') }}
    group by session_id

),

revenue as (

    select
        a.session_id,
        sum(a.billed_zar) as billed_zar,
    from {{ ref('fct_appointment') }} a
    group by a.session_id

),

final as (

    select
        s.session_id,
        s.clinic_code,
        s.practitioner_id,
        p.discipline,
        s.session_date,
        date_trunc('month', s.session_date)::date as session_month,
        extract(isodow from s.session_date)::integer as day_of_week,
        s.start_hour,
        s.end_hour,
        s.slot_minutes,
        s.slots_offered,
        coalesce(b.slots_booked, 0) as slots_booked,
        coalesce(b.slots_attended, 0) as slots_attended,
        coalesce(b.slots_no_show, 0) as slots_no_show,
        coalesce(b.slots_cancelled, 0) as slots_cancelled,
        s.slots_offered - coalesce(b.slots_booked, 0) as slots_unfilled,
        s.sessional_cost_zar,
        s.cost_per_slot_zar,
        round(s.cost_per_slot_zar * (s.slots_offered - coalesce(b.slots_booked, 0)), 2)
            as unfilled_cost_zar,
        round(s.cost_per_slot_zar * coalesce(b.slots_no_show, 0), 2) as no_show_cost_zar,
        coalesce(r.billed_zar, 0) as billed_zar,
        b.avg_wait_minutes,
        coalesce(b.slots_booked, 0)::double / nullif(s.slots_offered, 0) as fill_rate,
        coalesce(b.slots_attended, 0)::double / nullif(s.slots_offered, 0) as attended_rate,
    from {{ ref('sl_sessions') }} s
    left join {{ ref('sl_practitioners') }} p using (practitioner_id)
    left join booked b using (session_id)
    left join revenue r using (session_id)

)

select * from final
