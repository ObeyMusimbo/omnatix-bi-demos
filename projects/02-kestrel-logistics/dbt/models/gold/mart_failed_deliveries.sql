-- Finding 2: deliveries that had to be done twice.
--
-- A failed drop earns nothing and still consumed a slot on a truck that had already been
-- paid for. It never appears in a revenue report, because there is no revenue to report.
-- Grain: customer x month.

with base as (

    select
        c.customer_id,
        c.customer_name,
        c.contract_type,
        c.sector,
        c.origin_depot_code,
        c.month_start_date,
        strftime(c.month_start_date, '%Y-%m') as year_month,
        count(*) as drops,
        count(*) filter (where c.is_failed) as failed_drops,
        round(sum(c.revenue_zar), 2) as revenue_zar,
        -- The cost of getting to a door that would not take the freight.
        round(sum(case when c.is_failed then c.allocated_trip_cost_zar else 0 end), 2) as failed_cost_zar,
    from {{ ref('fct_consignment') }} c
    where c.trip_is_known
    group by 1, 2, 3, 4, 5, 6, 7

),

reasons as (

    select
        customer_id,
        mode(failure_reason) as top_failure_reason,
    from {{ ref('fct_consignment') }}
    where is_failed and failure_reason is not null
    group by 1

),

final as (

    select
        b.*,
        round(b.failed_drops * 100.0 / nullif(b.drops, 0), 2) as failure_rate_pct,
        r.top_failure_reason,
        -- A site that turns away a quarter of what arrives is not having bad luck. It has no
        -- booked receiving slot, and that is a conversation, not an analysis.
        b.failed_drops * 1.0 / nullif(b.drops, 0) > 0.15 as is_problem_site,
    from base b
    left join reasons r on b.customer_id = r.customer_id

)

select * from final
