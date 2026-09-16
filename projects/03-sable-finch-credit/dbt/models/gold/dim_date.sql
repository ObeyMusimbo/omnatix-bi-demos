-- The reporting calendar, one row per month end across the book's life.

with bounds as (
    select min(disbursement_date) as lo, max(snapshot_date) as hi
    from {{ ref('sl_loans') }}, {{ ref('sl_arrears_snapshots') }}
),
spine as (
    select unnest(generate_series(
        date_trunc('month', (select lo from bounds))::date,
        date_trunc('month', (select hi from bounds))::date,
        interval 1 month))::date as month_start_date
),
final as (
    select
        month_start_date,
        (month_start_date + interval 1 month - interval 1 day)::date as month_end_date,
        strftime(month_start_date, '%Y-%m') as year_month,
        year(month_start_date) as year,
        month(month_start_date) as month_num,
        monthname(month_start_date) as month_name,
        left(monthname(month_start_date), 3) as month_short,
        quarter(month_start_date) as quarter,
    from spine
)
select * from final
