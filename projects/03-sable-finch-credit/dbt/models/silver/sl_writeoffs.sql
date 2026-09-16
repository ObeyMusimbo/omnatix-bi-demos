-- Silver: loans written off, and anything recovered since.

with final as (
    select
        {{ clean_text('loan_id') }} as loan_id,
        {{ parse_mixed_date('writeoff_date') }} as writeoff_date,
        {{ parse_decimal('outstanding_at_writeoff_zar') }} as outstanding_at_writeoff_zar,
        {{ parse_decimal('recovery_to_date_zar') }} as recovery_to_date_zar,
    from {{ ref('br_writeoffs') }}
)
select * from final
