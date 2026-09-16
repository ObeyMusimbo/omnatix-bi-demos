-- Finding 2: loans written with nothing left after the instalment.
--
-- The one finding here that is not primarily a credit question. Section 81 of the National
-- Credit Act obliges the lender to establish that the client can service the agreement. An
-- agreement entered into without that is reckless, and under section 83 a court may set aside
-- the obligations in whole or in part. So the exposure is not the expected loss on these
-- loans. It is the entire outstanding balance.
--
-- Grain: cohort month x branch x affordability band.

with banded as (
    select
        cohort_month,
        cohort_label,
        branch_code,
        branch_name,
        case
            when breaches_affordability_floor then 'Breaches floor'
            when affordability_is_marginal then 'Under R500 headroom'
            else 'Within policy'
        end as affordability_band,
        count(*) as loans,
        sum(principal_zar) as principal_zar,
        sum(current_balance_zar) as outstanding_zar,
        count(*) filter (where ever_90) as loans_ever_90,
        sum(case when ever_90 then principal_zar else 0 end) as principal_ever_90,
        sum(net_loss_zar) as net_loss_zar,
        avg(disposable_after_instalment_zar) as avg_headroom_zar,
        avg(instalment_to_income_pct) as avg_instalment_to_income_pct,
    from {{ ref('dim_loan') }}
    group by 1, 2, 3, 4, 5
),

final as (
    select
        cohort_month,
        cohort_label,
        branch_code,
        branch_name,
        affordability_band,
        loans,
        round(principal_zar, 2) as principal_zar,
        round(outstanding_zar, 2) as outstanding_zar,
        loans_ever_90,
        round(principal_ever_90, 2) as principal_ever_90,
        round(net_loss_zar, 2) as net_loss_zar,
        round(avg_headroom_zar, 2) as avg_headroom_zar,
        round(avg_instalment_to_income_pct, 2) as avg_instalment_to_income_pct,
        round(principal_ever_90 / nullif(principal_zar, 0) * 100, 2) as bad_rate_pct,
        affordability_band = 'Breaches floor' as is_reckless_exposure,
    from banded
)

select * from final

