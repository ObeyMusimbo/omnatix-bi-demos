-- Finding 1: the branch that turned, and the mechanism behind it.
--
-- Grain: branch x cohort month. The divergence is only visible on a cohort basis. On a
-- portfolio view this branch looks unremarkable, because its older and better book is still
-- sitting in the denominator diluting everything it has written since.

with cohort_perf as (
    select
        branch_code,
        branch_name,
        province,
        cohort_month,
        cohort_label,
        date_trunc('quarter', cohort_month)::date as cohort_quarter,
        count(*) as loans,
        sum(principal_zar) as principal_zar,
        count(*) filter (where ever_90) as loans_ever_90,
        sum(case when ever_90 then principal_zar else 0 end) as principal_ever_90,
        -- The mechanism: income recorded on the assessment against the income on the client
        -- record. A branch writing sound business has a ratio near one.
        avg(declared_to_file_income_ratio) as avg_declared_to_file_ratio,
        count(*) filter (where income_declared_above_file) as loans_income_inflated,
        count(*) filter (where breaches_affordability_floor) as loans_breaching_floor,
        sum(net_loss_zar) as net_loss_zar,
    from {{ ref('dim_loan') }}
    group by 1, 2, 3, 4, 5, 6
),

book_benchmark as (
    select
        cohort_month,
        sum(case when ever_90 then principal_zar else 0 end)
            / nullif(sum(principal_zar), 0) * 100 as book_bad_rate_pct,
    from {{ ref('dim_loan') }}
    group by 1
),

final as (
    select
        c.branch_code,
        c.branch_name,
        c.province,
        c.cohort_month,
        c.cohort_label,
        c.cohort_quarter,
        c.loans,
        round(c.principal_zar, 2) as principal_zar,
        c.loans_ever_90,
        round(c.principal_ever_90, 2) as principal_ever_90,
        round(c.principal_ever_90 / nullif(c.principal_zar, 0) * 100, 2) as bad_rate_pct,
        round(b.book_bad_rate_pct, 2) as book_bad_rate_pct,
        -- How many times the book rate this branch is running at for the same cohort. Same
        -- month, same economy, same product: the only variable left is who wrote it.
        round((c.principal_ever_90 / nullif(c.principal_zar, 0) * 100)
              / nullif(b.book_bad_rate_pct, 0), 2) as bad_rate_vs_book_x,
        round(c.avg_declared_to_file_ratio, 3) as avg_declared_to_file_ratio,
        c.loans_income_inflated,
        round(c.loans_income_inflated * 100.0 / nullif(c.loans, 0), 1) as income_inflated_pct,
        c.loans_breaching_floor,
        round(c.net_loss_zar, 2) as net_loss_zar,
    from cohort_perf c
    left join book_benchmark b on c.cohort_month = b.cohort_month
)

select * from final

