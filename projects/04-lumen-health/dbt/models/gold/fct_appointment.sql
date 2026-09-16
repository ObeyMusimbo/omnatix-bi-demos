-- The central fact: one row per booked slot, with everything that happened to the money
-- attached to it.
--
-- Three things worth knowing about the joins.
--
-- Encounters are many to one against an appointment, so they are aggregated before the join
-- rather than joined and then aggregated. Joining first and summing later is how a visit
-- with two line items silently doubles the claim value beside it.
--
-- Payments are also many to one, because a refund is a second line against the same visit.
-- The refund carries a zero charge and a negative receipt, so summing both columns gives the
-- net position without special casing.
--
-- A claim is one to one after silver deduplicates the switch retries.
--
-- An appointment that was never attended has no encounter, no claim and no payment. Those
-- columns are left null rather than zeroed, because zero billed and not billed at all are
-- different facts and only one of them belongs in an average.

with billed as (

    select
        appointment_id,
        sum(billed_zar) as billed_zar,
        count(*) as line_items,
        count(*) filter (where icd10_missing) as lines_without_icd10,
    from {{ ref('sl_encounters') }}
    group by appointment_id

),

collected as (

    select
        appointment_id,
        sum(amount_due_zar) as patient_due_zar,
        sum(amount_paid_zar) as patient_paid_zar,
        max(case when is_refund then 1 else 0 end) = 1 as has_refund,
        max(payment_type) filter (where not is_refund) as payment_type,
    from {{ ref('sl_patient_payments') }}
    where appointment_is_known
    group by appointment_id

),

joined as (

    select
        a.appointment_id,
        a.session_id,
        a.clinic_code,
        a.practitioner_id,
        a.patient_ref,
        a.booked_at,
        a.scheduled_at,
        a.scheduled_date,
        a.scheduled_month,
        a.day_of_week,
        a.slot_hour,
        a.duration_minutes,
        a.status,
        a.is_attended,
        a.is_no_show,
        a.reminder_sent,
        a.booking_lead_days,
        a.booking_lead_band,
        a.booking_lead_order,
        a.wait_minutes,

        p.discipline,
        pt.scheme_code,

        b.billed_zar,
        b.line_items,
        coalesce(b.lines_without_icd10, 0) as lines_without_icd10,

        c.claim_id,
        c.status as claim_status,
        c.rejection_reason,
        c.resubmitted,
        c.claimed_zar,
        c.paid_zar as scheme_paid_zar,
        c.shortfall_zar as scheme_shortfall_zar,
        c.days_to_settle,
        c.was_submitted_twice,

        col.patient_due_zar,
        col.patient_paid_zar,
        col.payment_type,
        coalesce(col.has_refund, false) as has_refund,

    from {{ ref('sl_appointments') }} a
    left join {{ ref('sl_practitioners') }} p using (practitioner_id)
    left join {{ ref('sl_patients') }} pt using (patient_ref)
    left join billed b using (appointment_id)
    left join {{ ref('sl_claims') }} c using (appointment_id)
    left join collected col using (appointment_id)

),

final as (

    select
        *,
        -- Rejected for a reason a clerk can put right and resubmit, as against one the
        -- scheme was never going to pay. The two are the same rand and completely different
        -- work, so they never share a bucket on the dashboard.
        case
            when rejection_reason in ('Incorrect ICD-10 code', 'Missing referral',
                                      'Authorisation not obtained', 'Practice number incorrect')
                then 'Fixable at the practice'
            when rejection_reason in ('Benefit exhausted', 'Membership lapsed at date of service',
                                      'Service not covered on plan')
                then 'No cover, becomes a patient account'
            else null
        end as rejection_class,
        coalesce(patient_due_zar, 0) - coalesce(patient_paid_zar, 0) as patient_shortfall_zar,
    from joined

)

select * from final
