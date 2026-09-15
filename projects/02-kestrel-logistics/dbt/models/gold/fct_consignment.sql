-- fct_consignment
--
-- One row per drop, with the trip's cost shared across the drops it carried. Failed
-- deliveries are kept with zero revenue and a full share of the cost, because that is the
-- truth: the truck went, the slot was used, nothing was earned.

with consignments as (

    select * from {{ ref('sl_consignments') }}

),

trip_drop_weight as (

    select
        trip_id,
        sum(coalesce(weight_kg, 0)) as trip_weight_kg,
        count(*) as trip_drops,
    from consignments
    where trip_is_known
    group by 1

),

final as (

    select
        c.consignment_id,
        c.trip_id,
        c.trip_is_known,
        t.trip_date,
        t.month_start_date,
        t.lane_id,
        t.lane_name,
        t.lane_type,
        t.origin_depot_code,
        t.vehicle_class,
        c.customer_id,
        cu.customer_name,
        cu.contract_type,
        cu.sector,
        cu.is_anchor_account,
        c.drop_sequence,
        c.sla_window_start,
        c.sla_window_end,
        c.delivered_at,
        c.weight_kg,
        c.weight_is_estimated,
        c.volume_m3,
        c.revenue_zar,
        c.status,
        c.failure_reason,
        c.is_failed,
        c.is_on_time,
        -- Trip cost shared by weight where weight is known, evenly otherwise. A failed drop
        -- still takes its share: the diesel was burned getting there.
        round(coalesce(
            case
                when w.trip_weight_kg > 0 and c.weight_kg is not null
                    then t.total_cost_zar * c.weight_kg / w.trip_weight_kg
                else t.total_cost_zar / nullif(w.trip_drops, 0)
            end, 0), 2) as allocated_trip_cost_zar,
    from consignments c
    left join {{ ref('fct_trip') }} t on c.trip_id = t.trip_id
    left join {{ ref('dim_customer') }} cu on c.customer_id = cu.customer_id
    left join trip_drop_weight w on c.trip_id = w.trip_id

)

select * from final
