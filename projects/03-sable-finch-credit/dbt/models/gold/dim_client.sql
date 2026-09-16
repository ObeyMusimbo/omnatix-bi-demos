-- One row per borrower.

with final as (
    select
        c.client_ref,
        c.home_branch_code,
        b.branch_name as home_branch_name,
        c.province,
        c.gender,
        c.age_band,
        c.employment_type,
        c.employer_sector,
        c.monthly_income_zar,
        c.payday_day,
        case
            when c.monthly_income_zar < 6250 then 'Under R6 250'
            when c.monthly_income_zar < 12000 then 'R6 250 to R12 000'
            when c.monthly_income_zar < 25000 then 'R12 000 to R25 000'
            else 'Over R25 000'
        end as income_band,
    from {{ ref('sl_clients') }} c
    left join {{ ref('sl_branches') }} b on c.home_branch_code = b.branch_code
)
select * from final
