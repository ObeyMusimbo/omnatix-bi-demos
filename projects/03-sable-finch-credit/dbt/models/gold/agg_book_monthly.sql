-- The board pack view of the book: balances and portfolio at risk, month by month.
--
-- This is the number the business reports on, and finding 3 is that it can improve while the
-- book gets worse, because refinancing an arrears loan into a bigger new one closes the old
-- account as settled and resets the clock on the new one.

with monthly as (
    select
        month_start_date,
        count(*) as accounts,
        sum(outstanding_balance_zar) as gross_book_zar,
        sum(case when days_past_due >= 30 then outstanding_balance_zar else 0 end) as par30_zar,
        sum(case when days_past_due >= 60 then outstanding_balance_zar else 0 end) as par60_zar,
        sum(case when days_past_due >= 90 then outstanding_balance_zar else 0 end) as par90_zar,
        count(*) filter (where days_past_due >= 30) as accounts_30,
        count(*) filter (where days_past_due >= 90) as accounts_90,
    from {{ ref('fct_loan_month') }}
    group by 1
),
originations as (
    select
        cohort_month as month_start_date,
        count(*) as loans_disbursed,
        sum(principal_zar) as disbursed_zar,
        count(*) filter (where is_topup) as topups_disbursed,
        sum(case when is_topup then principal_zar else 0 end) as topup_disbursed_zar,
    from {{ ref('dim_loan') }}
    group by 1
),
final as (
    select
        m.month_start_date,
        strftime(m.month_start_date, '%Y-%m') as year_month,
        m.accounts,
        round(m.gross_book_zar, 2) as gross_book_zar,
        round(m.par30_zar, 2) as par30_zar,
        round(m.par90_zar, 2) as par90_zar,
        round(m.par30_zar / nullif(m.gross_book_zar, 0) * 100, 2) as par30_pct,
        round(m.par60_zar / nullif(m.gross_book_zar, 0) * 100, 2) as par60_pct,
        round(m.par90_zar / nullif(m.gross_book_zar, 0) * 100, 2) as par90_pct,
        coalesce(o.loans_disbursed, 0) as loans_disbursed,
        round(coalesce(o.disbursed_zar, 0), 2) as disbursed_zar,
        coalesce(o.topups_disbursed, 0) as topups_disbursed,
        round(coalesce(o.topup_disbursed_zar, 0), 2) as topup_disbursed_zar,
        round(coalesce(o.topups_disbursed, 0) * 100.0 / nullif(o.loans_disbursed, 0), 2) as topup_share_pct,
    from monthly m
    left join originations o on m.month_start_date = o.month_start_date
)
select * from final order by month_start_date
