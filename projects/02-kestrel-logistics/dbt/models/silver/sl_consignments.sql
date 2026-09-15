-- Silver: one row per drop.
--
-- Resolves defect 6 (weights never captured), defect 8 (drops quoting trips that are not in
-- the trip file), and defect 9 (three delivery statuses written six ways).
--
-- A failed delivery is kept with zero revenue rather than filtered out. That is deliberate:
-- the whole of finding 2 is that a redelivery consumed a drop slot and earned nothing, and
-- filtering failures would make the cost of them disappear along with the rows.

with source as (

    select * from {{ ref('br_consignments') }}

),

known_trips as (

    select trip_id from {{ ref('sl_trips') }}

),

typed as (

    select
        {{ clean_text('consignment_id') }} as consignment_id,
        {{ clean_text('trip_id') }} as trip_id,
        {{ clean_text('customer_id') }} as customer_id,
        try_cast(drop_sequence as integer) as drop_sequence,
        {{ parse_mixed_timestamp('sla_window_start') }} as sla_window_start,
        {{ parse_mixed_timestamp('sla_window_end') }} as sla_window_end,
        {{ parse_mixed_timestamp('delivered_at') }} as delivered_at,
        -- Defect 6: about 2% of drops were loaded without anyone weighing them.
        try_cast(weight_kg as double) as reported_weight_kg,
        try_cast(volume_m3 as double) as volume_m3,
        {{ parse_decimal('revenue_zar') }} as revenue_zar,
        -- Defect 9: Delivered / DELIVERED / delivered, and the same for Failed.
        {{ canonical_status('status') }} as status,
        {{ clean_text('failure_reason') }} as failure_reason,
    from source

),

-- Defect 6 continued: freight has a fairly stable density, so a missing weight can be
-- recovered from the volume that was recorded. Using the median rather than the mean keeps
-- a handful of very dense or very light loads from dragging the estimate.
density as (

    select
        median(reported_weight_kg / nullif(volume_m3, 0)) as kg_per_m3
    from typed
    where reported_weight_kg is not null
      and volume_m3 > 0

),

final as (

    select
        typed.consignment_id,
        typed.trip_id,
        typed.customer_id,
        typed.drop_sequence,
        typed.sla_window_start,
        typed.sla_window_end,
        case when typed.status = 'Failed' then null else typed.delivered_at end as delivered_at,
        coalesce(
            typed.reported_weight_kg,
            round(typed.volume_m3 * density.kg_per_m3, 1)
        ) as weight_kg,
        typed.reported_weight_kg is null as weight_is_estimated,
        typed.volume_m3,
        typed.revenue_zar,
        typed.status,
        typed.failure_reason,
        typed.status = 'Failed' as is_failed,
        -- On time means delivered inside the window that was promised. A failed drop is not
        -- on time: it was not delivered at all, and counting it as neutral would flatter the
        -- service figure that finding 4 turns into a penalty.
        coalesce(
            typed.status = 'Delivered'
            and typed.delivered_at is not null
            and typed.delivered_at <= typed.sla_window_end,
            false
        ) as is_on_time,
        -- Defect 8: 90 drops quote a trip in the TRP-4xxxxx range that is absent from the
        -- trip file. They are kept and marked. An inner join downstream would make their
        -- revenue vanish silently, which is precisely the failure this pipeline exists to
        -- prevent. The relationship test on this column is set to warn, not fail, on purpose.
        known_trips.trip_id is not null as trip_is_known,
    from typed
    cross join density
    left join known_trips
        on typed.trip_id = known_trips.trip_id

)

select * from final
