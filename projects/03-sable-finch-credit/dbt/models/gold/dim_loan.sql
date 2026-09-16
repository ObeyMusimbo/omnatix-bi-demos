-- dim_loan
--
-- One row per loan, carrying everything known at origination plus how it eventually turned
-- out. This is the table every finding filters on, so each flag here is computed from a
-- column that exists in the source, never asserted.

with loans as (

    select * from {{ ref('sl_loans') }}

),

-- The worst state the loan ever reached, which is what a cohort curve is built from. A loan
-- that hit 90 days and then cured still went bad once, and pretending otherwise is how a book
-- flatters itself.
worst_state as (

    select
        loan_id,
        max(days_past_due) as peak_days_past_due,
        max(case when days_past_due >= 30 then 1 else 0 end) = 1 as ever_30,
        max(case when days_past_due >= 60 then 1 else 0 end) = 1 as ever_60,
        max(case when days_past_due >= 90 then 1 else 0 end) = 1 as ever_90,
        min(case when days_past_due >= 90 then snapshot_date end) as first_90_date,
        min(case when days_past_due >= 30 then snapshot_date end) as first_30_date,
    from {{ ref('sl_arrears_snapshots') }}
    group by 1

),

latest_position as (

    select
        loan_id,
        arg_max(outstanding_balance_zar, snapshot_date) as current_balance_zar,
        arg_max(days_past_due, snapshot_date) as current_days_past_due,
        arg_max(arrears_bucket, snapshot_date) as current_bucket,
        max(snapshot_date) as last_snapshot_date,
    from {{ ref('sl_arrears_snapshots') }}
    group by 1

),

first_payment as (

    select
        loan_id,
        max(case when is_first_payment_default then 1 else 0 end) = 1 as first_payment_defaulted,
    from {{ ref('sl_repayments') }}
    where loan_is_known
    group by 1

),

collected as (

    select
        loan_id,
        sum(amount_paid_zar) as total_collected_zar,
        count(*) filter (where status = 'Failed') as failed_instalments,
    from {{ ref('sl_repayments') }}
    where loan_is_known
      and not is_reversal
    group by 1

),

final as (

    select
        l.loan_id,
        l.client_ref,
        l.branch_code,
        b.branch_name,
        b.province,
        l.agent_id,
        ag.agent_name,
        l.disbursement_date,
        l.cohort_month,
        strftime(l.cohort_month, '%Y-%m') as cohort_label,
        l.principal_zar,
        l.initiation_fee_zar,
        l.capitalised_amount_zar,
        l.interest_rate_annual,
        l.rate_is_imputed,
        l.term_months,
        l.instalment_zar,
        l.purpose,
        l.status,

        -- Finding 3: this loan was written to settle another one that was already in arrears.
        l.is_topup,
        l.settles_loan_id,

        -- Finding 4: how long after the client is paid the debit order is presented.
        l.days_after_payday,
        l.debit_order_mismatched,
        l.instalment_to_income_pct,

        -- Finding 2: the affordability assessment, and whether it left the client anything.
        af.disposable_income_zar,
        af.disposable_after_instalment_zar,
        coalesce(af.breaches_affordability_floor, false) as breaches_affordability_floor,
        coalesce(af.is_marginal, false) as affordability_is_marginal,
        af.declared_gross_income_zar,
        cl.monthly_income_zar as client_income_on_file_zar,
        -- Finding 1: declared income materially above what the client record supports is the
        -- mechanism behind the branch that turned, and it is visible without accusing anyone.
        round(af.declared_gross_income_zar / nullif(cl.monthly_income_zar, 0), 3) as declared_to_file_income_ratio,
        af.declared_gross_income_zar > cl.monthly_income_zar * 1.1 as income_declared_above_file,

        coalesce(ws.ever_30, false) as ever_30,
        coalesce(ws.ever_60, false) as ever_60,
        coalesce(ws.ever_90, false) as ever_90,
        ws.peak_days_past_due,
        ws.first_30_date,
        ws.first_90_date,
        -- Months between disbursement and the loan first reaching 90 days. The x position on
        -- a vintage curve.
        case when ws.first_90_date is not null
             then date_diff('month', l.disbursement_date, ws.first_90_date) end as months_to_90,

        coalesce(fp.first_payment_defaulted, false) as first_payment_defaulted,
        coalesce(lp.current_balance_zar, 0) as current_balance_zar,
        coalesce(lp.current_days_past_due, 0) as current_days_past_due,
        coalesce(lp.current_bucket, 'Current') as current_bucket,
        coalesce(c.total_collected_zar, 0) as total_collected_zar,
        coalesce(c.failed_instalments, 0) as failed_instalments,

        wo.writeoff_date,
        coalesce(wo.outstanding_at_writeoff_zar, 0) as written_off_zar,
        coalesce(wo.recovery_to_date_zar, 0) as recovered_zar,
        wo.loan_id is not null as is_written_off,

        -- Net loss on the loan: what was written off, less anything recovered since.
        coalesce(wo.outstanding_at_writeoff_zar, 0) - coalesce(wo.recovery_to_date_zar, 0) as net_loss_zar,
    from loans l
    left join {{ ref('sl_branches') }} b on l.branch_code = b.branch_code
    left join {{ ref('sl_agents') }} ag on l.agent_id = ag.agent_id
    left join {{ ref('sl_clients') }} cl on l.client_ref = cl.client_ref
    left join {{ ref('sl_affordability') }} af on l.loan_id = af.loan_id
    left join worst_state ws on l.loan_id = ws.loan_id
    left join latest_position lp on l.loan_id = lp.loan_id
    left join first_payment fp on l.loan_id = fp.loan_id
    left join collected c on l.loan_id = c.loan_id
    left join {{ ref('sl_writeoffs') }} wo on l.loan_id = wo.loan_id

)

select * from final
