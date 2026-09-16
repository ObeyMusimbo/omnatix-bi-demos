-- mart_vintage
--
-- The one chart that makes this demo worth an hour of a chief risk officer's time.
--
-- Portfolio at risk is a snapshot of a book of different ages mixed together. It can improve
-- for reasons that have nothing to do with credit quality: write off the worst accounts,
-- refinance the delinquent ones, or simply grow fast enough that new lending dilutes the
-- denominator. A vintage curve cannot be moved that way. It fixes each cohort at the month
-- the money went out and follows only that cohort, so month six of one cohort is compared
-- with month six of another and nothing else.
--
-- Grain: cohort month x months on book.
--
-- Read down a column to see whether the business is writing better or worse business than it
-- was a year ago. That question is unanswerable from a portfolio at risk number, and it is
-- the question that decides whether a lender survives.

with cohort_base as (

    select
        cohort_month,
        cohort_label,
        branch_code,
        branch_name,
        count(*) as cohort_loans,
        sum(principal_zar) as cohort_principal_zar,
    from {{ ref('dim_loan') }}
    group by 1, 2, 3, 4

),

-- Every month on book each cohort has actually been observed for. A cohort written last month
-- has one point; one written eighteen months ago has eighteen. Extending a young cohort with
-- zeroes would draw a flat line that looks like excellent performance, which is the single
-- most common way a vintage chart lies.
observed as (

    select
        cohort_month,
        branch_code,
        max(months_on_book) as max_months_observed,
    from {{ ref('fct_loan_month') }}
    group by 1, 2

),

spine as (

    select
        b.cohort_month,
        b.cohort_label,
        b.branch_code,
        b.branch_name,
        b.cohort_loans,
        b.cohort_principal_zar,
        m.months_on_book,
    from cohort_base b
    join observed o
        on b.cohort_month = o.cohort_month
       and b.branch_code = o.branch_code
    cross join (select unnest(generate_series(0, 24)) as months_on_book) m
    where m.months_on_book <= o.max_months_observed

),

-- Cumulative bad: a loan counts from the month it first reached ninety days and stays counted
-- afterwards, because a cohort does not get to un-default.
reached_90 as (

    select
        cohort_month,
        branch_code,
        months_to_90,
        count(*) as loans,
        sum(principal_zar) as principal_zar,
    from {{ ref('dim_loan') }}
    where months_to_90 is not null
    group by 1, 2, 3

),

accumulated as (

    select
        s.cohort_month,
        s.cohort_label,
        s.branch_code,
        s.branch_name,
        s.months_on_book,
        s.cohort_loans,
        s.cohort_principal_zar,
        coalesce(sum(r.loans), 0) as bad_loans,
        coalesce(sum(r.principal_zar), 0) as bad_principal_zar,
    from spine s
    left join reached_90 r
        on s.cohort_month = r.cohort_month
       and s.branch_code = r.branch_code
       and r.months_to_90 <= s.months_on_book
    group by 1, 2, 3, 4, 5, 6, 7

),

final as (

    select
        cohort_month,
        cohort_label,
        branch_code,
        branch_name,
        months_on_book,
        cohort_loans,
        round(cohort_principal_zar, 2) as cohort_principal_zar,
        bad_loans,
        round(bad_principal_zar, 2) as bad_principal_zar,
        -- The curve itself: the share of the cohort, by value lent, that had reached ninety
        -- days by this point in its life.
        round(bad_principal_zar / nullif(cohort_principal_zar, 0) * 100, 3) as cumulative_bad_rate_pct,
        round(bad_loans * 100.0 / nullif(cohort_loans, 0), 3) as cumulative_bad_loans_pct,
    from accumulated

)

select * from final
