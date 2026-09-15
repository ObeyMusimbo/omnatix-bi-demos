-- Finding 4: Friday, and the last two days of the month.
--
-- Dispatch batches whatever is still standing into one run, trucks leave late, and the
-- promised window is missed. Grain: dispatch day bucket x month x whether this is the
-- anchor account.
--
-- The anchor account's contract carries a penalty of 2% of monthly spend for every
-- percentage point of on-time performance below 90%.

{% set penalty_threshold = 90 %}
{% set penalty_rate_per_point = 0.02 %}

with drops as (

    select
        c.consignment_id,
        c.customer_id,
        c.is_anchor_account,
        c.is_on_time,
        c.is_failed,
        c.revenue_zar,
        d.month_start_date,
        d.year_month,
        d.dispatch_day_bucket,
        d.day_name,
    from {{ ref('fct_consignment') }} c
    join {{ ref('dim_date') }} d on c.trip_date = d.date_day
    where c.trip_is_known

),

by_bucket as (

    select
        month_start_date,
        year_month,
        dispatch_day_bucket,
        is_anchor_account,
        count(*) as drops,
        count(*) filter (where is_on_time) as on_time_drops,
        count(*) filter (where is_failed) as failed_drops,
        round(sum(revenue_zar), 2) as revenue_zar,
    from drops
    group by 1, 2, 3, 4

),

final as (

    select
        month_start_date,
        year_month,
        dispatch_day_bucket,
        is_anchor_account,
        drops,
        on_time_drops,
        failed_drops,
        revenue_zar,
        round(on_time_drops * 100.0 / nullif(drops, 0), 2) as on_time_pct,
        {{ penalty_threshold }} as penalty_threshold_pct,
        round(greatest({{ penalty_threshold }} - on_time_drops * 100.0 / nullif(drops, 0), 0), 2) as points_below_threshold,
        -- Only the anchor account's contract carries the clause. Everyone else's late
        -- delivery costs goodwill, which does not show up here.
        case when is_anchor_account
             then round(greatest({{ penalty_threshold }} - on_time_drops * 100.0 / nullif(drops, 0), 0)
                        * {{ penalty_rate_per_point }} * revenue_zar, 2)
             else 0 end as penalty_exposure_zar,
    from by_bucket

)

select * from final
