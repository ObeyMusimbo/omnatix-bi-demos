-- Silver: the loan book.
--
-- Resolves defect 1 (two disbursement date formats), defect 4 (amounts written with
-- separators), defect 6 (interest rates lost on migration) and defect 9 (status casing).
--
-- Also derives the two flags the findings hang off. Both are computed from columns already
-- in the source rather than asserted, so an analyst can follow the reasoning: the gap between
-- the debit order day and the client payday, and whether this loan settled another one.

with source as (

    select * from {{ ref('br_loans') }}

),

clients as (

    select client_ref, payday_day, monthly_income_zar from {{ ref('sl_clients') }}

),

typed as (

    select
        {{ clean_text('source.loan_id') }} as loan_id,
        {{ clean_text('source.client_ref') }} as client_ref,
        {{ clean_text('source.branch_code') }} as branch_code,
        {{ clean_text('source.agent_id') }} as agent_id,
        -- Defect 1: the origination system writes ISO, the branch capture tool DD/MM/YYYY.
        {{ parse_mixed_date('source.disbursement_date') }} as disbursement_date,
        {{ parse_decimal('source.principal_zar') }} as principal_zar,
        {{ parse_decimal('source.initiation_fee_zar') }} as initiation_fee_zar,
        -- Defect 4: large amounts are sometimes written with thousand separators.
        {{ parse_decimal('source.capitalised_amount_zar') }} as capitalised_amount_zar,
        try_cast(nullif(trim(source.interest_rate_annual::varchar), '') as double) as reported_rate,
        try_cast(source.term_months as integer) as term_months,
        {{ parse_decimal('source.monthly_service_fee_zar') }} as monthly_service_fee_zar,
        {{ parse_decimal('source.credit_life_monthly_zar') }} as credit_life_monthly_zar,
        {{ parse_decimal('source.instalment_zar') }} as instalment_zar,
        try_cast(source.debit_order_day as integer) as debit_order_day,
        {{ clean_text('source.purpose') }} as purpose,
        upper(trim(source.is_topup::varchar)) = 'Y' as is_topup,
        {{ clean_text('source.settles_loan_id') }} as settles_loan_id,
        -- Defect 9: Active / ACTIVE / active, and the same for the other two.
        case lower(trim(source.status::varchar))
            when 'active' then 'Active'
            when 'settled' then 'Settled'
            when 'written off' then 'Written off'
        end as status,
        clients.payday_day,
        clients.monthly_income_zar,
    from source
    left join clients on {{ clean_text('source.client_ref') }} = clients.client_ref

),

-- Defect 6: about 2.5% of loans lost their interest rate when the book was migrated. Filled
-- with the median rate written on the same term in the same month, which is the closest thing
-- to the rate that loan was actually priced at.
rate_defaults as (

    select
        term_months,
        date_trunc('month', disbursement_date) as month_start,
        median(reported_rate) as default_rate,
    from typed
    where reported_rate is not null
    group by 1, 2

),

final as (

    select
        t.loan_id,
        t.client_ref,
        t.branch_code,
        t.agent_id,
        t.disbursement_date,
        date_trunc('month', t.disbursement_date)::date as cohort_month,
        t.principal_zar,
        t.initiation_fee_zar,
        t.capitalised_amount_zar,
        coalesce(t.reported_rate, r.default_rate) as interest_rate_annual,
        t.reported_rate is null as rate_is_imputed,
        t.term_months,
        t.monthly_service_fee_zar,
        t.credit_life_monthly_zar,
        t.instalment_zar,
        t.debit_order_day,
        t.purpose,
        t.is_topup,
        nullif(t.settles_loan_id, '') as settles_loan_id,
        t.status,

        -- Days between the client being paid and the debit order being presented. Presenting
        -- before the salary lands, or a week after it has been spent, fails for reasons that
        -- have nothing to do with willingness. Finding 4.
        ((t.debit_order_day - t.payday_day) + 28) % 28 as days_after_payday,
        ((t.debit_order_day - t.payday_day) + 28) % 28 > 3 as debit_order_mismatched,

        -- Instalment as a share of gross monthly income. A blunt but universally understood
        -- affordability sense check that sits alongside the formal assessment.
        round(t.instalment_zar / nullif(t.monthly_income_zar, 0) * 100, 2) as instalment_to_income_pct,
    from typed t
    left join rate_defaults r
        on t.term_months = r.term_months
       and date_trunc('month', t.disbursement_date) = r.month_start

)

select * from final
