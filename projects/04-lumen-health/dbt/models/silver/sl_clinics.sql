-- Silver: the six sites.
--
-- The site name is captured at each front desk and arrives in three spellings. Folded to
-- one for display; nothing joins on it.

with final as (
    select
        {{ clean_text('clinic_code') }} as clinic_code,
        {{ canonical_site_name('clinic_name') }} as clinic_name,
        {{ clean_text('city') }} as city,
        {{ clean_text('province') }} as province,
        try_cast(consulting_rooms as integer) as consulting_rooms,
        {{ parse_mixed_date('opened_date') }} as opened_date,
    from {{ ref('br_clinics') }}
)
select * from final
