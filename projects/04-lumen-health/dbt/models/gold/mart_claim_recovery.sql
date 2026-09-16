{#
  What the schemes sent back, and what happened next.

  The grain is one row per rejection reason per site, which is the grain a practice manager
  can act on: a reason without a site tells you nothing about who to talk to, and a site
  without a reason tells you nothing about what to say.

  ever_rejected counts a claim that came back rejected or short paid at any point, including
  the ones that were fixed and paid on resubmission. That is the denominator for a recovery
  rate. Using the still-outstanding claims as the denominator would flatter every site,
  because the ones that worked their rejections have fewer left.
#}

with rejected as (

    select
        a.clinic_code,
        a.rejection_reason,
        a.rejection_class,
        a.claim_status,
        a.resubmitted,
        a.claimed_zar,
        a.scheme_paid_zar,
        a.scheme_shortfall_zar,
    from {{ ref('fct_appointment') }} a
    where a.rejection_reason is not null

),

by_cell as (

    select
        clinic_code,
        rejection_reason,
        rejection_class,
        count(*) as ever_rejected,
        count(*) filter (where claim_status = 'Paid on resubmission') as recovered_claims,
        count(*) filter (where resubmitted) as resubmitted_claims,
        sum(claimed_zar) as claimed_zar,
        sum(claimed_zar) filter (where claim_status = 'Paid on resubmission') as recovered_zar,
        sum(scheme_shortfall_zar) as outstanding_zar,
    from rejected
    group by all

),

totals as (

    select
        sum(ever_rejected) as all_rejected,
        sum(recovered_claims) as all_recovered_claims,
        sum(recovered_zar) as all_recovered_zar,
        sum(outstanding_zar) as all_outstanding_zar,
        sum(outstanding_zar) filter (where rejection_class = 'Fixable at the practice')
            as all_fixable_outstanding_zar,
        sum(outstanding_zar) filter (where rejection_class = 'No cover, becomes a patient account')
            as all_no_cover_outstanding_zar,
    from by_cell

),

claim_base as (

    select
        count(*) as all_claims,
        sum(claimed_zar) as all_claimed_zar,
    from {{ ref('sl_claims') }}

),

final as (

    select
        b.clinic_code,
        c.clinic_name,
        b.rejection_reason,
        b.rejection_class,
        b.ever_rejected,
        b.resubmitted_claims,
        b.recovered_claims,
        round(b.claimed_zar, 2) as claimed_zar,
        round(coalesce(b.recovered_zar, 0), 2) as recovered_zar,
        round(b.outstanding_zar, 2) as outstanding_zar,
        round(100.0 * b.resubmitted_claims / nullif(b.ever_rejected, 0), 1) as resubmitted_pct,
        round(100.0 * b.recovered_claims / nullif(b.ever_rejected, 0), 1) as recovery_pct,

        t.all_rejected,
        t.all_recovered_claims,
        round(t.all_recovered_zar, 2) as all_recovered_zar,
        round(t.all_outstanding_zar, 2) as all_outstanding_zar,
        round(t.all_fixable_outstanding_zar, 2) as all_fixable_outstanding_zar,
        round(t.all_no_cover_outstanding_zar, 2) as all_no_cover_outstanding_zar,
        cb.all_claims,
        round(cb.all_claimed_zar, 2) as all_claimed_zar,
        round(100.0 * t.all_rejected / nullif(cb.all_claims, 0), 1) as all_rejection_pct,

    from by_cell b
    cross join totals t
    cross join claim_base cb
    left join {{ ref('dim_clinic') }} c using (clinic_code)

)

select * from final order by outstanding_zar desc
