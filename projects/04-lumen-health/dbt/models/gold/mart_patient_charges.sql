{#
  What reception charged the patient, and what it actually took.

  The grain is site by charge type, and the charge type is the whole point. Blending them
  produces a collection rate around seventy per cent at every site, which looks like a mild
  and uniform problem and is not one: it is two very different behaviours averaged into a
  number that describes neither.

    Self funded    the patient owes the whole bill. It gets asked for, and it gets paid.
    Scheme gap     the patient owes the part the scheme does not cover. It is smaller, it is
                   owed by somebody who believes they are covered, and it mostly does not get
                   asked for at all.

  Refunds carry a zero charge and a negative receipt, so they are netted into the collected
  figure rather than shown as a third type. A credit note is not a charge.
#}

with lines as (

    select
        a.clinic_code,
        p.payment_type,
        p.amount_due_zar,
        p.amount_paid_zar,
        p.is_refund,
    from {{ ref('sl_patient_payments') }} p
    join {{ ref('fct_appointment') }} a using (appointment_id)
    where p.appointment_is_known

),

-- Refunds are folded into the type they reverse. They cannot be attributed to one, so they
-- are apportioned to nothing and simply reduce the site total, which is where they belong.
by_type as (

    select
        clinic_code,
        payment_type,
        count(*) as charge_lines,
        sum(amount_due_zar) as due_zar,
        sum(amount_paid_zar) as paid_zar,
    from lines
    where not is_refund
    group by all

),

refunds as (

    select
        clinic_code,
        count(*) as refund_lines,
        sum(amount_paid_zar) as refund_zar,
    from lines
    where is_refund
    group by all

),

totals as (

    select
        payment_type,
        sum(charge_lines) as all_lines,
        sum(due_zar) as all_due_zar,
        sum(paid_zar) as all_paid_zar,
        round(100.0 * sum(paid_zar) / nullif(sum(due_zar), 0), 1) as all_collected_pct,
    from by_type
    group by all

),

final as (

    select
        t.clinic_code,
        c.clinic_name,
        t.payment_type,
        t.charge_lines,
        round(t.due_zar, 2) as due_zar,
        round(t.paid_zar, 2) as paid_zar,
        round(t.due_zar - t.paid_zar, 2) as uncollected_zar,
        round(100.0 * t.paid_zar / nullif(t.due_zar, 0), 1) as collected_pct,
        round(t.due_zar / nullif(t.charge_lines, 0), 2) as avg_charge_zar,
        coalesce(r.refund_lines, 0) as refund_lines,
        round(coalesce(r.refund_zar, 0), 2) as refund_zar,

        g.all_lines as type_lines,
        round(g.all_due_zar, 2) as type_due_zar,
        round(g.all_paid_zar, 2) as type_paid_zar,
        g.all_collected_pct as type_collected_pct,

    from by_type t
    left join {{ ref('dim_clinic') }} c using (clinic_code)
    left join refunds r using (clinic_code)
    left join totals g using (payment_type)

)

select * from final order by payment_type, collected_pct
