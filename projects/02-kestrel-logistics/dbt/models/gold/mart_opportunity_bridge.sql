{#
  The closing visual.

  Meridian's bridge explains a year on year gap, because its findings are deterioration:
  discounts that crept, a promotion that got worse. Kestrel's are not. Empty returns, doors
  that will not receive, thirsty trucks and a service clause are standing costs that were
  just as true last year. Framing them as variance would be dishonest, and produces a
  meaningless residual.

  So this bridge runs the other way. It starts at what Kestrel actually earned and adds what
  each finding has identified, ending at what the same fleet and the same customers could
  contribute with nothing new bought.

  The figures are what the findings are worth in full. No operator recovers all of a number
  like this: a lane can be repriced or dropped, a receiving problem is a conversation, an
  injector is a workshop booking. Recovery assumptions belong in the conversation with the
  client, not baked into a mart.

  Every step covers the same trailing twelve months as the anchor. The thirsty vehicle step
  once summed two years against one year of everything else, which overstated the total by
  about a year of excess diesel.
#}

with actual as (

    select
        sum(revenue_zar) as ttm_revenue,
        sum(total_cost_zar) as ttm_cost,
        sum(revenue_zar) - sum(total_cost_zar) as ttm_contribution,
        sum(distance_km) as ttm_km,
    from {{ ref('fct_trip') }}
    where trip_date > date '{{ var("period_end") }}'::date - interval 365 day

),

backhaul_traps as (

    -- Contribution is negative on these corridors, so the loss is what abs() recovers
    select coalesce(abs(sum(contribution_zar)), 0) as effect_zar
    from {{ ref('mart_lane_economics') }}
    where period_order = 1 and is_backhaul_trap

),

redeliveries as (

    select coalesce(sum(failed_cost_zar), 0) as effect_zar
    from {{ ref('mart_failed_deliveries') }}
    where is_trailing_twelve_months

),

thirsty as (

    select coalesce(sum(excess_cost_zar), 0) as effect_zar
    from {{ ref('mart_fuel_outliers') }}
    where is_outlier

),

penalties as (

    select coalesce(sum(penalty_exposure_zar), 0) as effect_zar
    from {{ ref('mart_sla_performance') }}
    where is_trailing_twelve_months

),

steps as (

    select 1 as step_order, 'Contribution earned in the last twelve months' as driver,
           'Earned today' as driver_short, 'anchor' as step_type,
           (select ttm_contribution from actual) as effect_zar, null as finding_ref
    union all
    select 2, 'Corridors that fund their own empty return', 'Empty returns', 'increase',
           (select effect_zar from backhaul_traps), '1'
    union all
    select 3, 'Deliveries that had to be done twice', 'Redeliveries', 'increase',
           (select effect_zar from redeliveries), '2'
    union all
    select 4, 'Vehicles burning more than their class', 'Thirsty vehicles', 'increase',
           (select effect_zar from thirsty), '3'
    union all
    select 5, 'Service penalties on the anchor account', 'Service penalties', 'increase',
           (select effect_zar from penalties), '4'
    union all
    select 6, 'Contribution with the same fleet and the same customers', 'Available', 'total',
           (select ttm_contribution from actual)
           + (select effect_zar from backhaul_traps)
           + (select effect_zar from redeliveries)
           + (select effect_zar from thirsty)
           + (select effect_zar from penalties), null

),

totals as (

    select
        (select effect_zar from backhaul_traps)
        + (select effect_zar from redeliveries)
        + (select effect_zar from thirsty)
        + (select effect_zar from penalties) as identified_zar

),

final as (

    select
        s.step_order,
        s.driver,
        s.driver_short,
        s.step_type,
        round(s.effect_zar, 2) as effect_zar,
        s.finding_ref,
        round(case
            when s.step_type in ('anchor', 'total') then s.effect_zar
            else (select ttm_contribution from actual)
                 + sum(case when s.step_type = 'increase' then s.effect_zar else 0 end)
                   over (order by s.step_order rows between unbounded preceding and current row)
        end, 2) as running_total_zar,
        round(case when s.step_type = 'increase'
                   then s.effect_zar / nullif(t.identified_zar, 0) * 100 end, 2) as pct_of_identified,
        round(t.identified_zar, 2) as identified_zar,
        round(a.ttm_revenue, 2) as ttm_revenue_zar,
        round(a.ttm_cost, 2) as ttm_cost_zar,
        round(a.ttm_contribution, 2) as ttm_contribution_zar,
        round(a.ttm_contribution / nullif(a.ttm_revenue, 0) * 100, 2) as ttm_contribution_margin_pct,
        round(a.ttm_km, 0) as ttm_km,
        round(a.ttm_cost / nullif(a.ttm_km, 0), 3) as ttm_cost_per_km_zar,
        round(a.ttm_revenue / nullif(a.ttm_km, 0), 3) as ttm_revenue_per_km_zar,
        -- What the findings are worth against what the business actually earns. This is the
        -- number the demo closes on.
        round(t.identified_zar / nullif(a.ttm_contribution, 0) * 100, 1) as identified_pct_of_contribution,
    from steps s
    cross join totals t
    cross join actual a

)

select * from final order by step_order
