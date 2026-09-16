-- Silver: the branch network.

with final as (
    select
        {{ clean_text('branch_code') }} as branch_code,
        {{ clean_text('branch_name') }} as branch_name,
        {{ clean_text('province') }} as province,
        {{ clean_text('city') }} as city,
        {{ parse_mixed_date('opened_date') }} as opened_date,
    from {{ ref('br_branches') }}
)
select * from final
