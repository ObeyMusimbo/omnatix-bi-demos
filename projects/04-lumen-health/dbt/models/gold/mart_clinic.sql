-- The site scorecard. One row per clinic, carrying one column for each of the five findings
-- so the whole page can be read down a single table if somebody prefers that.
--
-- Everything money-shaped here is attributed through an appointment, so the payment rows
-- that quote an unknown visit are excluded. They are worth a few thousand rand in total and
-- they appear on the data quality panel instead, which is the right place for a number that
-- exists but cannot be given an owner.

with activity as (

    select
        clinic_code,
        count(*) as appointments,
        count(*) filter (where is_attended) as attended,
        count(*) filter (where is_no_show) as no_shows,
        count(*) filter (where reminder_sent) as reminded,
        avg(booking_lead_days) as avg_lead_days,
        avg(wait_minutes) filter (where is_attended) as avg_wait_minutes,
        sum(billed_zar) as billed_zar,
        sum(claimed_zar) as claimed_zar,
        sum(scheme_paid_zar) as scheme_paid_zar,
        sum(scheme_shortfall_zar) as scheme_shortfall_zar,
        sum(patient_due_zar) as patient_due_zar,
        sum(patient_paid_zar) as patient_paid_zar,
        count(*) filter (where rejection_reason is not null) as ever_rejected,
        count(*) filter (where claim_status = 'Paid on resubmission') as recovered_claims,
    from {{ ref('fct_appointment') }}
    group by all

),

capacity as (

    select
        clinic_code,
        count(distinct practitioner_id) as practitioners,
        count(*) as sessions,
        sum(slots_offered) as slots_offered,
        sum(slots_unfilled) as slots_unfilled,
        sum(sessional_cost_zar) as sessional_cost_zar,
        sum(unfilled_cost_zar) as unfilled_cost_zar,
        sum(no_show_cost_zar) as no_show_cost_zar,
    from {{ ref('fct_session') }}
    group by all

),

final as (

    select
        c.clinic_code,
        c.clinic_name,
        c.city,
        c.province,
        c.consulting_rooms,
        k.practitioners,
        k.sessions,
        k.slots_offered,
        k.slots_unfilled,
        a.appointments,
        a.attended,
        a.no_shows,

        round(100.0 * a.appointments / nullif(k.slots_offered, 0), 1) as fill_pct,
        round(100.0 * a.no_shows / nullif(a.appointments, 0), 1) as no_show_pct,
        round(100.0 * a.reminded / nullif(a.appointments, 0), 1) as reminded_pct,
        round(a.avg_lead_days, 1) as avg_lead_days,
        round(a.avg_wait_minutes, 1) as avg_wait_minutes,

        round(a.billed_zar, 2) as billed_zar,
        round(a.claimed_zar, 2) as claimed_zar,
        round(a.scheme_paid_zar, 2) as scheme_paid_zar,
        round(a.scheme_shortfall_zar, 2) as scheme_shortfall_zar,
        round(a.patient_due_zar, 2) as patient_due_zar,
        round(a.patient_paid_zar, 2) as patient_paid_zar,
        round(a.patient_due_zar - a.patient_paid_zar, 2) as patient_shortfall_zar,
        round(100.0 * a.patient_paid_zar / nullif(a.patient_due_zar, 0), 1) as gap_collected_pct,

        a.ever_rejected,
        a.recovered_claims,
        round(100.0 * a.recovered_claims / nullif(a.ever_rejected, 0), 1) as recovery_pct,

        round(k.sessional_cost_zar, 2) as sessional_cost_zar,
        round(k.unfilled_cost_zar, 2) as unfilled_cost_zar,
        round(k.no_show_cost_zar, 2) as no_show_cost_zar,
        round(100.0 * k.sessional_cost_zar / nullif(a.billed_zar, 0), 1) as clinician_cost_pct_of_billed,

        round(a.scheme_shortfall_zar + (a.patient_due_zar - a.patient_paid_zar), 2)
            as total_leakage_zar,

    from {{ ref('dim_clinic') }} c
    left join activity a using (clinic_code)
    left join capacity k using (clinic_code)

)

select * from final order by billed_zar desc
