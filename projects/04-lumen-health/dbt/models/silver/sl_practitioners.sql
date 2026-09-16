-- Silver: the consulting roster.
--
-- sessional_cost_zar is the number that makes an empty slot expensive. The group pays it
-- for the session, not for the patients seen in it.

with final as (
    select
        {{ clean_text('practitioner_id') }} as practitioner_id,
        {{ clean_text('practitioner_name') }} as practitioner_name,
        {{ clean_text('discipline') }} as discipline,
        {{ clean_text('clinic_code') }} as clinic_code,
        {{ clean_text('practice_number') }} as practice_number,
        try_cast(sessional_cost_zar as double) as sessional_cost_zar,
        {{ parse_mixed_date('joined_date') }} as joined_date,
    from {{ ref('br_practitioners') }}
)
select * from final
