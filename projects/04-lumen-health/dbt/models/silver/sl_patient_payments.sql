-- Silver: what reception collected.
--
-- Two things that look like errors and are not. Refunds land as negative amounts against a
-- zero charge, and they are kept, because netting them out is the only way the collected
-- figure is true. And a handful of rows quote an appointment that is not in the appointment
-- file, which is a genuine capture fault: the money exists, the visit it belongs to does
-- not. Those rows are flagged rather than deleted, counted on the data quality panel, and
-- excluded from anything that joins through an appointment.

with parsed as (

    select
        {{ clean_text('payment_id') }} as payment_id,
        {{ clean_text('appointment_id') }} as appointment_id,
        {{ parse_decimal('amount_due_zar') }} as amount_due_zar,
        {{ parse_decimal('amount_paid_zar') }} as amount_paid_zar,
        {{ clean_text('payment_type') }} as payment_type,
        {{ parse_mixed_date('collected_at') }} as collected_at,
    from {{ ref('br_patient_payments') }}

),

final as (

    select
        p.payment_id,
        p.appointment_id,
        p.amount_due_zar,
        p.amount_paid_zar,
        p.payment_type,
        p.collected_at,
        a.appointment_id is not null as appointment_is_known,
        p.payment_type = 'Refund' as is_refund,
        round(p.amount_due_zar - p.amount_paid_zar, 2) as uncollected_zar,
    from parsed p
    left join {{ ref('sl_appointments') }} a using (appointment_id)

)

select * from final
