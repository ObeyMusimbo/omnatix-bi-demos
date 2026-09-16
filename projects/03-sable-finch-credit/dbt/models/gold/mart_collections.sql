-- Finding 5: collections effort against where it can actually work.
--
-- Cure rates fall off a cliff with age. An account one month down is still a conversation, one
-- six months down is usually a legal process. The dialler does not know that, so it works the
-- oldest queue first, which is the one where almost nothing can be recovered.
--
-- Grain: arrears bucket.

with effort as (
    select
        arrears_bucket_at_time as arrears_bucket,
        count(*) as activities,
        sum(cost_zar) as cost_zar,
        count(*) filter (where is_productive) as productive_contacts,
        count(distinct loan_id) as accounts_worked,
    from {{ ref('sl_collections_activity') }}
    group by 1
),

-- Whether an account sitting in a bucket at one month end had come back to current by the
-- next one. This is the measure that should be directing the effort.
transitions as (
    select
        arrears_bucket,
        count(*) as observations,
        count(*) filter (where next_bucket = 'Current') as cured_next_month,
    from (
        select
            arrears_bucket,
            lead(arrears_bucket) over (partition by loan_id order by snapshot_date) as next_bucket,
        from {{ ref('fct_loan_month') }}
    )
    where arrears_bucket <> 'Current'
    group by 1
),

exposure as (
    select
        arrears_bucket,
        sum(outstanding_balance_zar) as balance_in_bucket_zar,
    from {{ ref('fct_loan_month') }}
    where snapshot_date = (select max(snapshot_date) from {{ ref('fct_loan_month') }})
    group by 1
),

final as (
    select
        e.arrears_bucket,
        e.activities,
        round(e.cost_zar, 2) as cost_zar,
        round(e.cost_zar * 100.0 / sum(e.cost_zar) over (), 2) as share_of_spend_pct,
        e.productive_contacts,
        round(e.productive_contacts * 100.0 / nullif(e.activities, 0), 2) as contact_rate_pct,
        e.accounts_worked,
        t.observations,
        t.cured_next_month,
        round(t.cured_next_month * 100.0 / nullif(t.observations, 0), 2) as cure_rate_pct,
        round(coalesce(x.balance_in_bucket_zar, 0), 2) as balance_in_bucket_zar,
        -- Rand of collections spend for every account that came back to current. The finding
        -- is the spread between the top of this column and the bottom.
        round(e.cost_zar / nullif(t.cured_next_month, 0), 2) as cost_per_cure_zar,
    from effort e
    left join transitions t on e.arrears_bucket = t.arrears_bucket
    left join exposure x on e.arrears_bucket = x.arrears_bucket
)

select * from final

