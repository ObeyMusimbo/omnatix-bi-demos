{#
  The closing view: everything billed for care that was actually delivered, walked down to
  the cash that reached the bank.

  Two rules this model exists to enforce.

  Every rand of the shortfall lands in exactly one bucket, and the buckets are defined by who
  has to do something about it rather than by who refused to pay. A claim rejected for a
  missing referral and a claim rejected because the member had no cover are the same rand and
  entirely different work: one is a resubmission, the other is an invoice to the patient that
  nobody raised. Splitting them by reason would put both under 'rejections' and lose that.

  And the bridge closes or it says so. The anchor is what was billed, the steps are the
  shortfalls, and the total is the cash actually received, computed independently. If those
  two disagree by more than a rand the gap is carried on the model as a column rather than
  quietly absorbed, because a bridge that does not close is not a bridge.

  What is deliberately NOT in here: the cost of empty clinician time, and the revenue lost to
  patients who never arrived. Both are real and both are bigger. Neither was ever billed, so
  adding them to a collection bridge would be adding a forecast to a ledger.
#}

with billed as (

    select sum(billed_zar) as billed_zar
    from {{ ref('sl_encounters') }}

),

scheme as (

    select
        sum(claimed_zar) as claimed_zar,
        sum(paid_zar) as scheme_paid_zar,
        sum(shortfall_zar) as scheme_shortfall_zar,
    from {{ ref('sl_claims') }}

),

-- The shortfall split by what would have to happen to recover it.
scheme_split as (

    select
        sum(scheme_shortfall_zar) filter (where rejection_class = 'Fixable at the practice')
            as fixable_zar,
        count(*) filter (where rejection_class = 'Fixable at the practice')
            as fixable_claims,
        sum(scheme_shortfall_zar) filter (where rejection_class = 'No cover, becomes a patient account')
            as no_cover_zar,
        count(*) filter (where rejection_class = 'No cover, becomes a patient account')
            as no_cover_claims,
    from {{ ref('fct_appointment') }}
    where coalesce(scheme_shortfall_zar, 0) > 0

),

patient as (

    select
        sum(amount_due_zar) as patient_due_zar,
        sum(amount_paid_zar) filter (where not is_refund) as patient_paid_zar,
        sum(amount_paid_zar) filter (where is_refund) as refund_zar,
        count(*) filter (where is_refund) as refund_lines,
    from {{ ref('sl_patient_payments') }}

),

totals as (

    select
        b.billed_zar,
        s.claimed_zar,
        s.scheme_paid_zar,
        s.scheme_shortfall_zar,
        ss.fixable_zar,
        ss.fixable_claims,
        ss.no_cover_zar,
        ss.no_cover_claims,
        p.patient_due_zar,
        p.patient_paid_zar,
        p.refund_zar,
        p.refund_lines,
        p.patient_due_zar - p.patient_paid_zar as patient_shortfall_zar,
        s.scheme_paid_zar + p.patient_paid_zar + p.refund_zar as cash_received_zar,
    from billed b
    cross join scheme s
    cross join scheme_split ss
    cross join patient p

),

steps as (

    select 1 as step_order,
           'Billed for care delivered' as step_label,
           'Billed' as step_short,
           'anchor' as step_type,
           (select billed_zar from totals) as effect_zar,
           null as finding_ref
    union all
    select 2, 'Rejected for something the practice can fix, and never reworked',
           'Fixable rejections', 'decrease',
           -(select fixable_zar from totals), '2'
    union all
    select 3, 'Rejected because there was no cover, and never billed to the patient',
           'No cover', 'decrease',
           -(select no_cover_zar from totals), '2'
    union all
    select 4, 'Gap and self funded charges left uncollected at reception',
           'Uncollected at reception', 'decrease',
           -(select patient_shortfall_zar from totals), '5'
    union all
    select 5, 'Refunds and credit notes', 'Refunds', 'decrease',
           (select refund_zar from totals), null
    union all
    select 6, 'Cash received for care delivered', 'Cash received', 'total',
           (select cash_received_zar from totals), null

),

final as (

    select
        s.step_order,
        s.step_label,
        s.step_short,
        s.step_type,
        round(s.effect_zar, 2) as effect_zar,
        s.finding_ref,
        round(case
            when s.step_type in ('anchor', 'total') then s.effect_zar
            else (select billed_zar from totals)
                 + sum(case when s.step_type = 'decrease' then s.effect_zar else 0 end)
                   over (order by s.step_order rows between unbounded preceding and current row)
        end, 2) as running_total_zar,

        round(t.billed_zar, 2) as billed_zar,
        round(t.cash_received_zar, 2) as cash_received_zar,
        round(t.billed_zar - t.cash_received_zar, 2) as total_leakage_zar,
        round((t.billed_zar - t.cash_received_zar) / nullif(t.billed_zar, 0) * 100, 2)
            as leakage_pct_of_billed,
        round(t.scheme_shortfall_zar, 2) as scheme_shortfall_zar,
        round(t.patient_shortfall_zar, 2) as patient_shortfall_zar,
        t.fixable_claims,
        t.no_cover_claims,
        t.refund_lines,

        -- The assertion. Anchor less every step should be the cash, to the rand.
        round(
            t.billed_zar
            - t.fixable_zar - t.no_cover_zar - t.patient_shortfall_zar + t.refund_zar
            - t.cash_received_zar, 2) as reconciliation_gap_zar,

    from steps s
    cross join totals t

)

select * from final order by step_order
