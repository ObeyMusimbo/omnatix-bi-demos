{#
  One row per payer.

  Days to settle is measured from submission to payment, not from the date of service, so a
  scheme that pays slowly and a practice that claims slowly stay two separate problems.

  working_capital_zar is the money a slow payer keeps locked up: the practice's own daily
  claim value against that scheme, multiplied by the days it settles beyond the group median.
  It is a balance sheet number, not a loss. It is reported here and never once added to the
  collection bridge, because the money does arrive. It just arrives late, and in the meantime
  somebody is financing it.
#}

with by_scheme as (

    select
        c.scheme_code,
        count(*) as claims,
        sum(c.claimed_zar) as claimed_zar,
        sum(c.paid_zar) as paid_zar,
        sum(c.shortfall_zar) as shortfall_zar,
        count(*) filter (where c.is_outstanding) as outstanding_claims,
        avg(c.days_to_settle) as avg_days_to_settle,
        quantile_cont(c.days_to_settle, 0.5) as median_days_to_settle,
        quantile_cont(c.days_to_settle, 0.9) as p90_days_to_settle,
    from {{ ref('sl_claims') }} c
    group by all

),

gaps as (

    select
        pt.scheme_code,
        sum(a.patient_due_zar) as patient_due_zar,
        sum(a.patient_paid_zar) as patient_paid_zar,
        count(*) filter (where a.patient_due_zar > 0) as visits_with_a_gap,
    from {{ ref('fct_appointment') }} a
    join {{ ref('sl_patients') }} pt using (patient_ref)
    where a.is_attended
    group by all

),

benchmark as (

    select median(avg_days_to_settle) as group_median_days
    from by_scheme

),

window_days as (

    select date_diff('day', min(submitted_at), max(submitted_at)) as observed_days
    from {{ ref('sl_claims') }}

),

final as (

    select
        s.scheme_code,
        d.scheme_name,
        d.payment_terms_days,
        d.tariff_factor,
        d.gap_pct_of_tariff,
        d.is_self_funded,
        s.claims,
        round(s.claimed_zar, 2) as claimed_zar,
        round(s.paid_zar, 2) as paid_zar,
        round(s.shortfall_zar, 2) as shortfall_zar,
        s.outstanding_claims,
        round(100.0 * s.outstanding_claims / nullif(s.claims, 0), 1) as denial_pct,
        round(s.avg_days_to_settle, 1) as avg_days_to_settle,
        round(s.median_days_to_settle, 1) as median_days_to_settle,
        round(s.p90_days_to_settle, 1) as p90_days_to_settle,
        round(s.avg_days_to_settle - b.group_median_days, 1) as days_beyond_group_median,
        round(b.group_median_days, 1) as group_median_days,

        -- Daily claim value against this scheme, times the days it runs beyond the median.
        round(greatest(0, s.avg_days_to_settle - b.group_median_days)
              * s.claimed_zar / nullif(w.observed_days, 0), 2) as working_capital_zar,

        round(coalesce(g.patient_due_zar, 0), 2) as patient_due_zar,
        round(coalesce(g.patient_paid_zar, 0), 2) as patient_paid_zar,
        g.visits_with_a_gap,
        round(100.0 * g.patient_paid_zar / nullif(g.patient_due_zar, 0), 1) as gap_collected_pct,

    from by_scheme s
    left join {{ ref('dim_scheme') }} d using (scheme_code)
    left join gaps g using (scheme_code)
    cross join benchmark b
    cross join window_days w

)

select * from final order by claimed_zar desc
