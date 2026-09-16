-- Finding 3: refinancing that moves the problem rather than solving it.
--
-- A client falls behind. Rather than collect, the branch writes a new and larger loan that
-- settles the old one. The old account closes as Settled, which reads as a good outcome and
-- takes its arrears out of the portfolio at risk number. The client now owes more than before
-- against the same income, and the clock on the new loan starts at zero.
--
-- Nothing here is hidden in the source. Every top-up names the loan it settled. Nobody had
-- joined the two.
--
-- Grain: one row per top-up, with the account it settled alongside it.

with topups as (
    select
        t.loan_id as topup_loan_id,
        t.cohort_month,
        t.cohort_label,
        t.branch_code,
        t.branch_name,
        t.agent_name,
        t.client_ref,
        t.principal_zar as topup_principal_zar,
        t.instalment_zar as topup_instalment_zar,
        t.ever_90 as topup_ever_90,
        t.current_days_past_due as topup_current_dpd,
        t.current_balance_zar as topup_balance_zar,
        t.net_loss_zar as topup_net_loss_zar,
        t.status as topup_status,
        s.loan_id as settled_loan_id,
        s.principal_zar as settled_principal_zar,
        s.instalment_zar as settled_instalment_zar,
        s.peak_days_past_due as settled_peak_dpd,
        s.status as settled_status,
    from {{ ref('dim_loan') }} t
    left join {{ ref('dim_loan') }} s on t.settles_loan_id = s.loan_id
    where t.is_topup
),

final as (
    select
        *,
        -- What the client owes each month after the refinance, against before it.
        round(topup_instalment_zar - coalesce(settled_instalment_zar, 0), 2) as instalment_increase_zar,
        round(topup_principal_zar / nullif(settled_principal_zar, 0), 2) as principal_multiple,
        -- The old account was already in arrears when it was settled. Those arrears left the
        -- portfolio at risk number without a cent being collected.
        coalesce(settled_peak_dpd, 0) >= 30 as settled_account_was_delinquent,
    from topups
)

select * from final

