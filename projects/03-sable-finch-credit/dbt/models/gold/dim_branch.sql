-- One row per branch.

with final as (
    select
        b.branch_code,
        b.branch_name,
        b.province,
        b.city,
        b.opened_date,
        count(distinct a.agent_id) as agent_count,
    from {{ ref('sl_branches') }} b
    left join {{ ref('sl_agents') }} a on b.branch_code = a.branch_code
    group by 1, 2, 3, 4, 5
)
select * from final
