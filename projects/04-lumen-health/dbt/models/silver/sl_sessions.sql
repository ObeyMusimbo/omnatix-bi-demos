-- Silver: the capacity grid.
--
-- One row per practitioner per room per block of hours. slots_offered is the denominator of
-- every utilisation figure on the dashboard, and sessional_cost_zar is what that capacity
-- cost whether it was used or not. Session dates arrive in two formats.

with final as (
    select
        {{ clean_text('session_id') }} as session_id,
        {{ clean_text('clinic_code') }} as clinic_code,
        {{ clean_text('practitioner_id') }} as practitioner_id,
        {{ parse_mixed_date('session_date') }} as session_date,
        {{ clean_text('start_time') }} as start_time,
        {{ clean_text('end_time') }} as end_time,
        try_cast(slot_minutes as integer) as slot_minutes,
        try_cast(slots_offered as integer) as slots_offered,
        try_cast(sessional_cost_zar as double) as sessional_cost_zar,
    from {{ ref('br_sessions') }}
),

derived as (
    select
        *,
        -- Cost of one slot of clinician time. An unfilled slot is this much, spent.
        sessional_cost_zar / nullif(slots_offered, 0) as cost_per_slot_zar,
        try_cast(substr(start_time, 1, 2) as integer) as start_hour,
        try_cast(substr(end_time, 1, 2) as integer) as end_hour,
    from final
)
select * from derived
