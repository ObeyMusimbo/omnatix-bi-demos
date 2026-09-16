-- The monthly trend line.
--
-- Two things are guarded here. The first and last month of the window are partial, because
-- the export starts and ends mid-period, and a partial month plotted next to a whole one
-- reads as a collapse. Any month whose offered capacity is under half the median is dropped
-- and the fact is recorded on the model, so the chart can say so rather than just showing a
-- shorter line.
--
-- And the denominators are the same every month. Fill is against capacity offered that
-- month, not against the busiest month, so a quiet December looks quiet rather than broken.

with capacity as (

    select
        session_month as month_start,
        sum(slots_offered) as slots_offered,
        sum(slots_unfilled) as slots_unfilled,
        sum(sessional_cost_zar) as sessional_cost_zar,
    from {{ ref('fct_session') }}
    group by all

),

activity as (

    select
        scheduled_month as month_start,
        count(*) as appointments,
        count(*) filter (where is_attended) as attended,
        count(*) filter (where is_no_show) as no_shows,
        sum(billed_zar) as billed_zar,
        sum(claimed_zar) as claimed_zar,
        sum(scheme_paid_zar) as scheme_paid_zar,
        sum(scheme_shortfall_zar) as scheme_shortfall_zar,
        sum(patient_due_zar) as patient_due_zar,
        sum(patient_paid_zar) as patient_paid_zar,
        avg(wait_minutes) filter (where is_attended) as avg_wait_minutes,
    from {{ ref('fct_appointment') }}
    group by all

),

joined as (

    select
        c.month_start,
        c.slots_offered,
        c.slots_unfilled,
        c.sessional_cost_zar,
        a.appointments,
        a.attended,
        a.no_shows,
        a.billed_zar,
        a.claimed_zar,
        a.scheme_paid_zar,
        a.scheme_shortfall_zar,
        a.patient_due_zar,
        a.patient_paid_zar,
        a.avg_wait_minutes,
    from capacity c
    left join activity a using (month_start)

),

benchmark as (

    select median(slots_offered) as median_slots from joined

),

final as (

    select
        j.month_start,
        strftime(j.month_start, '%b %y') as month_label,
        j.slots_offered,
        j.slots_unfilled,
        j.appointments,
        j.attended,
        j.no_shows,
        round(100.0 * j.appointments / nullif(j.slots_offered, 0), 1) as fill_pct,
        round(100.0 * j.no_shows / nullif(j.appointments, 0), 1) as no_show_pct,
        round(j.billed_zar, 2) as billed_zar,
        round(j.claimed_zar, 2) as claimed_zar,
        round(j.scheme_paid_zar, 2) as scheme_paid_zar,
        round(j.scheme_shortfall_zar, 2) as scheme_shortfall_zar,
        round(100.0 * j.scheme_shortfall_zar / nullif(j.claimed_zar, 0), 1) as scheme_shortfall_pct,
        round(j.patient_due_zar, 2) as patient_due_zar,
        round(j.patient_paid_zar, 2) as patient_paid_zar,
        round(100.0 * j.patient_paid_zar / nullif(j.patient_due_zar, 0), 1) as gap_collected_pct,
        round(j.sessional_cost_zar, 2) as sessional_cost_zar,
        round(100.0 * j.sessional_cost_zar / nullif(j.billed_zar, 0), 1) as clinician_cost_pct,
        round(j.avg_wait_minutes, 1) as avg_wait_minutes,
    from joined j
    cross join benchmark b
    where j.slots_offered >= b.median_slots * 0.5

)

select * from final order by month_start
