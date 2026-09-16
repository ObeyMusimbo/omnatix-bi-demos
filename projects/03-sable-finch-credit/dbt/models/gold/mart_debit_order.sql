-- Finding 4: debit orders presented on the wrong day.
--
-- A debit order presented before the salary lands fails for insufficient funds however willing
-- the client is, and one presented a week after payday competes with everything the household
-- has already spent. This is not a credit problem, it is a diary problem, and it is the
-- cheapest thing on this page to fix.
--
-- Grain: days between payday and the collection date.

with by_gap as (
    select
        days_after_payday,
        case
            when days_after_payday <= 1 then 'On or next day'
            when days_after_payday <= 3 then 'Within 3 days'
            when days_after_payday <= 7 then '4 to 7 days'
            else 'Over a week after payday'
        end as timing_band,
        count(*) as loans,
        sum(principal_zar) as principal_zar,
        count(*) filter (where first_payment_defaulted) as first_payment_defaults,
        count(*) filter (where ever_90) as loans_ever_90,
        sum(case when ever_90 then principal_zar else 0 end) as principal_ever_90,
        sum(net_loss_zar) as net_loss_zar,
    from {{ ref('dim_loan') }}
    where days_after_payday is not null
    group by 1, 2
),

final as (
    select
        days_after_payday,
        timing_band,
        loans,
        round(principal_zar, 2) as principal_zar,
        first_payment_defaults,
        loans_ever_90,
        round(principal_ever_90, 2) as principal_ever_90,
        round(net_loss_zar, 2) as net_loss_zar,
        round(first_payment_defaults * 100.0 / nullif(loans, 0), 2) as first_payment_default_pct,
        round(principal_ever_90 / nullif(principal_zar, 0) * 100, 2) as bad_rate_pct,
        days_after_payday > 3 as is_mismatched,
    from by_gap
)

select * from final order by days_after_payday

