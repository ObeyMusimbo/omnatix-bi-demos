-- Silver: booked slots.
--
-- Three derived columns carry most of the operational story:
--
--   booking_lead_band   how far ahead the slot was taken. A booking made six weeks out is a
--                       different animal from one made yesterday, and it does not turn up.
--   wait_minutes        scheduled time to seen time. Seen early lands negative, which is
--                       kept rather than floored, because a diary that runs early is as
--                       much a signal as one that runs late.
--   slot_hour           the hour of the day the slot sits in, which is the axis the
--                       utilisation story is told on.
--
-- Status arrives in three casings and is mapped explicitly, so an unexpected value becomes
-- null and fails a test rather than quietly becoming a fourth status.

with parsed as (

    select
        {{ clean_text('appointment_id') }} as appointment_id,
        {{ clean_text('session_id') }} as session_id,
        {{ clean_text('clinic_code') }} as clinic_code,
        {{ clean_text('practitioner_id') }} as practitioner_id,
        {{ clean_text('patient_ref') }} as patient_ref,
        {{ parse_mixed_timestamp('booked_at') }} as booked_at,
        {{ parse_mixed_timestamp('scheduled_at') }} as scheduled_at,
        try_cast(duration_minutes as integer) as duration_minutes,
        {{ parse_mixed_timestamp('arrived_at') }} as arrived_at,
        {{ parse_mixed_timestamp('seen_at') }} as seen_at,
        {{ canonical_appointment_status('status') }} as status,
        {{ yn_flag('reminder_sent') }} as reminder_sent,
        try_cast(booking_lead_days as integer) as booking_lead_days,
    from {{ ref('br_appointments') }}

),

derived as (

    select
        *,
        scheduled_at::date as scheduled_date,
        date_trunc('month', scheduled_at)::date as scheduled_month,
        extract(isodow from scheduled_at)::integer as day_of_week,
        extract(hour from scheduled_at)::integer as slot_hour,
        status = 'No show' as is_no_show,
        status = 'Attended' as is_attended,
        case
            when booking_lead_days is null then null
            when booking_lead_days <= 2  then '0 to 2 days'
            when booking_lead_days <= 6  then '3 to 6 days'
            when booking_lead_days <= 13 then '1 to 2 weeks'
            when booking_lead_days <= 20 then '2 to 3 weeks'
            else 'Over 3 weeks'
        end as booking_lead_band,
        case
            when booking_lead_days is null then null
            when booking_lead_days <= 2  then 1
            when booking_lead_days <= 6  then 2
            when booking_lead_days <= 13 then 3
            when booking_lead_days <= 20 then 4
            else 5
        end as booking_lead_order,
        case
            when seen_at is null or scheduled_at is null then null
            else date_diff('minute', scheduled_at, seen_at)
        end as wait_minutes,
    from parsed

)

select * from derived
