-- Silver: trade customers, one row per account.
-- Resolves defect 2 (stray whitespace on customer_name) and defect 3 (channel casing).

with source as (

    select * from {{ ref('br_customers') }}

),

cleaned as (

    select
        {{ clean_text('customer_id') }} as customer_id,
        -- Defect 2: names arrive padded ('  Baywater Market #04', 'Highveld Grocer #02 ').
        -- Untrimmed they sort into the wrong place and break any join or grouping on name.
        {{ clean_text('customer_name') }} as customer_name,
        -- Defect 3: channel is written in three casings (Modern Trade / MODERN TRADE /
        -- modern trade). The macro maps them explicitly, so a genuinely new channel comes
        -- through as null and trips the tests rather than quietly becoming a fifth channel.
        {{ canonical_channel('channel') }} as channel,
        {{ clean_text('region') }} as region,
        {{ clean_text('city') }} as city,
        try_cast(trim(credit_terms_days::varchar) as integer) as credit_terms_days,
        {{ clean_text('rep_id') }} as rep_id,
        try_cast(trim(rebate_pct::varchar) as double) as rebate_pct,
        {{ parse_mixed_date('onboarded_date') }} as onboarded_date
    from source

),

final as (

    select
        customer_id,
        customer_name,
        channel,
        region,
        city,
        credit_terms_days,
        rep_id,
        rebate_pct,
        onboarded_date
    from cleaned

)

select * from final
