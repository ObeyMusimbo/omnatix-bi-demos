-- fct_loan_month
--
-- One row per loan per month end: where the account stood, and how long it had been on book.
-- This is the spine every cohort curve and every roll rate is built from.

with final as (
    select
        a.snapshot_date,
        date_trunc('month', a.snapshot_date)::date as month_start_date,
        a.loan_id,
        l.branch_code,
        l.branch_name,
        l.agent_id,
        l.cohort_month,
        l.cohort_label,
        l.principal_zar,
        l.is_topup,
        l.breaches_affordability_floor,
        l.debit_order_mismatched,
        -- Months elapsed since the money went out. The x axis of a vintage curve, and the
        -- only way to compare a cohort written last month with one written two years ago.
        date_diff('month', l.disbursement_date, a.snapshot_date) as months_on_book,
        a.days_past_due,
        a.arrears_bucket,
        a.outstanding_balance_zar,
        a.arrears_amount_zar,
        a.is_npl,
        a.conflicts_with_payment_history,
    from {{ ref('sl_arrears_snapshots') }} a
    join {{ ref('dim_loan') }} l on a.loan_id = l.loan_id
)
select * from final
