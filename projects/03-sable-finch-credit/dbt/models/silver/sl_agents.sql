-- Silver: loan officers. The agent who signed the assessment is the accountable party when
-- a cohort turns, which is what makes finding 1 actionable rather than merely interesting.

with final as (
    select
        {{ clean_text('agent_id') }} as agent_id,
        {{ clean_text('agent_name') }} as agent_name,
        {{ clean_text('branch_code') }} as branch_code,
        {{ parse_mixed_date('hired_date') }} as hired_date,
    from {{ ref('br_agents') }}
)
select * from final
