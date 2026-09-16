{#
  The closing view, and deliberately two numbers rather than one.

  Credit loss and regulatory exposure are different things and mixing them produces a figure
  that is wrong in both directions. So this mart carries the loss bridge, and the reckless
  lending exposure is reported alongside it rather than added into it.

  Every loan is attributed to exactly one driver, in order of severity, so nothing is counted
  twice. A Mahikeng loan that also breaches the affordability floor is counted once, against
  the floor, because that is the more serious of the two and the one with a legal consequence.
  Excess loss is measured against what the same money would have lost at the clean book rate.
#}

with attributed as (

    select
        loan_id,
        principal_zar,
        current_balance_zar,
        net_loss_zar,
        ever_90,
        case
            when breaches_affordability_floor then 'Written outside affordability policy'
            when branch_code = 'SF-MAH' and cohort_month >= date '2025-05-01'
                then 'The branch that turned'
            when is_topup then 'Arrears refinanced into a new loan'
            when debit_order_mismatched then 'Collection date missing payday'
            else 'Baseline book'
        end as driver,
    from {{ ref('dim_loan') }}

),

baseline as (

    -- What a rand lent looks like when none of the four conditions apply. Everything else is
    -- measured against this.
    select
        sum(net_loss_zar) / nullif(sum(principal_zar), 0) as baseline_loss_rate,
    from attributed
    where driver = 'Baseline book'

),

by_driver as (

    select
        a.driver,
        count(*) as loans,
        sum(a.principal_zar) as principal_zar,
        sum(a.current_balance_zar) as outstanding_zar,
        sum(a.net_loss_zar) as net_loss_zar,
        count(*) filter (where a.ever_90) as loans_ever_90,
        -- What this slice would have lost had it behaved like the clean book
        sum(a.principal_zar) * b.baseline_loss_rate as expected_at_baseline_zar,
        sum(a.net_loss_zar) - sum(a.principal_zar) * b.baseline_loss_rate as excess_loss_zar,
    from attributed a
    cross join baseline b
    group by a.driver, b.baseline_loss_rate

),

totals as (

    select
        sum(d.net_loss_zar) as total_loss_zar,
        sum(case when d.driver <> 'Baseline book' then d.excess_loss_zar else 0 end) as total_excess_zar,
        sum(d.principal_zar) as total_principal_zar,
        -- The counterfactual the bridge opens on: every rand on the book losing at the rate
        -- the clean slice of it actually lost at. Anchoring on the clean slice's own loss
        -- instead leaves the bridge short by everything the other slices would have lost
        -- anyway, and it then fails to close on the real number.
        sum(d.principal_zar) * max(b.baseline_loss_rate) as whole_book_at_baseline_zar,
    from by_driver d
    cross join baseline b

),

-- Reported separately, never added to the loss bridge. This is outstanding balance on
-- agreements a court could set aside under section 83 of the National Credit Act, not an
-- expected loss. Treating it as a credit number understates it; adding it to one overstates
-- the credit number.
reckless as (

    select
        count(*) as loans,
        sum(current_balance_zar) as outstanding_zar,
    from {{ ref('dim_loan') }}
    where breaches_affordability_floor
      and status <> 'Written off'

),

steps as (

    select 1 as step_order,
           'Loss the clean book would have produced' as driver,
           'Baseline book' as driver_short,
           'anchor' as step_type,
           (select whole_book_at_baseline_zar from totals) as effect_zar,
           null as finding_ref
    union all
    select 2, 'Written outside affordability policy', 'Outside policy', 'increase',
           (select excess_loss_zar from by_driver where driver = 'Written outside affordability policy'), '2'
    union all
    select 3, 'The branch that turned', 'Branch that turned', 'increase',
           (select excess_loss_zar from by_driver where driver = 'The branch that turned'), '1'
    union all
    select 4, 'Arrears refinanced into a new loan', 'Refinanced arrears', 'increase',
           (select excess_loss_zar from by_driver where driver = 'Arrears refinanced into a new loan'), '3'
    union all
    select 5, 'Collection date missing payday', 'Wrong debit date', 'increase',
           (select excess_loss_zar from by_driver where driver = 'Collection date missing payday'), '4'
    union all
    select 6, 'Net credit loss recognised', 'Actual loss', 'total',
           (select total_loss_zar from totals), null

),

final as (

    select
        s.step_order,
        s.driver,
        s.driver_short,
        s.step_type,
        round(s.effect_zar, 2) as effect_zar,
        s.finding_ref,
        round(case
            when s.step_type in ('anchor', 'total') then s.effect_zar
            else (select whole_book_at_baseline_zar from totals)
                 + sum(case when s.step_type = 'increase' then s.effect_zar else 0 end)
                   over (order by s.step_order rows between unbounded preceding and current row)
        end, 2) as running_total_zar,
        round(case when s.step_type = 'increase'
                   then s.effect_zar / nullif(t.total_excess_zar, 0) * 100 end, 2) as pct_of_excess,
        round(t.total_loss_zar, 2) as total_loss_zar,
        round(t.total_excess_zar, 2) as total_excess_zar,
        round(t.total_excess_zar / nullif(t.total_loss_zar, 0) * 100, 1) as excess_pct_of_loss,
        round(t.total_principal_zar, 2) as total_principal_zar,
        round(t.total_loss_zar / nullif(t.total_principal_zar, 0) * 100, 2) as loss_rate_pct,
        r.loans as reckless_loans,
        round(r.outstanding_zar, 2) as reckless_exposure_zar,
    from steps s
    cross join totals t
    cross join reckless r

)

select * from final order by step_order
