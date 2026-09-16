-- Silver: what was done at the visit, and what it was billed at.
--
-- Two defects handled here. Amounts over a thousand rand are exported with thousands
-- separators inside quotes, so the column lands as text. And roughly one line in fifty lost
-- its ICD-10 code migrating off the old practice system. The code is not dropped or guessed:
-- the row is kept, flagged, and counted on the data quality panel, because a missing
-- diagnosis code is exactly the sort of thing that gets a claim rejected.

with parsed as (

    select
        {{ clean_text('encounter_id') }} as encounter_id,
        {{ clean_text('appointment_id') }} as appointment_id,
        {{ clean_text('icd10_code') }} as icd10_code,
        {{ clean_text('procedure_code') }} as procedure_code,
        {{ parse_decimal('billed_zar') }} as billed_zar,
    from {{ ref('br_encounters') }}

),

final as (

    select
        *,
        icd10_code is null as icd10_missing,
    from parsed

)

select * from final
