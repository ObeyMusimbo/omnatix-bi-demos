-- Silver: every collections contact and what it cost.
--
-- arrears_bucket_at_time is recorded by the dialler at the moment of the call, which is what
-- lets finding 5 compare where the effort went against where it could have worked.

with final as (
    select
        {{ clean_text('activity_id') }} as activity_id,
        {{ clean_text('loan_id') }} as loan_id,
        {{ parse_mixed_date('activity_date') }} as activity_date,
        {{ clean_text('channel') }} as channel,
        {{ clean_text('outcome') }} as outcome,
        {{ parse_decimal('cost_zar') }} as cost_zar,
        {{ clean_text('arrears_bucket_at_time') }} as arrears_bucket_at_time,
        {{ clean_text('outcome') }} in ('Paid in full', 'Partial payment', 'Promise to pay') as is_productive,
    from {{ ref('br_collections_activity') }}
)
select * from final
