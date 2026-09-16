-- Silver: borrowers.
--
-- payday_day matters more than it looks. A debit order presented before the salary lands
-- fails for insufficient funds no matter how willing the client is, which is finding 4.

with final as (
    select
        {{ clean_text('client_ref') }} as client_ref,
        {{ clean_text('home_branch_code') }} as home_branch_code,
        {{ clean_text('province') }} as province,
        {{ clean_text('gender') }} as gender,
        {{ clean_text('age_band') }} as age_band,
        {{ clean_text('employment_type') }} as employment_type,
        {{ clean_text('employer_sector') }} as employer_sector,
        try_cast(monthly_income_zar as double) as monthly_income_zar,
        try_cast(payday_day as integer) as payday_day,
    from {{ ref('br_clients') }}
)
select * from final
