-- Silver: registered patients.
--
-- There is no name, no date of birth and no identity number in this table, by design. An
-- age band and a scheme are everything the analysis needs, and a demo dataset for
-- healthcare should not carry a shape that could be mistaken for the real thing.

with final as (
    select
        {{ clean_text('patient_ref') }} as patient_ref,
        {{ clean_text('home_clinic_code') }} as home_clinic_code,
        {{ clean_text('province') }} as province,
        {{ clean_text('age_band') }} as age_band,
        {{ clean_text('gender') }} as gender,
        {{ clean_text('scheme_code') }} as scheme_code,
        {{ clean_text('scheme_plan') }} as scheme_plan,
    from {{ ref('br_patients') }}
)
select * from final
