-- One row per loan officer, with the branch they book at.
--
-- The agent who signed an affordability assessment is the accountable party when a cohort
-- turns, which is what makes finding 1 a conversation with a named person rather than an
-- observation about a region.

with final as (
    select
        a.agent_id,
        a.agent_name,
        a.branch_code,
        b.branch_name,
        b.province,
        a.hired_date,
    from {{ ref('sl_agents') }} a
    left join {{ ref('sl_branches') }} b on a.branch_code = b.branch_code
)
select * from final
