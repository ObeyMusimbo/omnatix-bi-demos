-- The bridge is the number the demo closes on, so it has to close: the anchor plus every
-- step lands on actual gross profit, and the drivers' shares of the gap sum to 100%. The
-- residual makes this true by construction, which is exactly why it needs holding in place:
-- a change that breaks the construction should fail the build, not redraw the waterfall.

with bridge as (

    select * from {{ ref('mart_gp_bridge') }}

),

check_totals as (

    select
        (select effect_zar from bridge where step_type = 'anchor')
        + (select sum(effect_zar) from bridge where step_type = 'decrease')
        - (select effect_zar from bridge where step_type = 'total') as unreconciled_zar,
        (select sum(pct_of_gap) from bridge where step_type = 'decrease') as shares_pct

),

final as (

    select * from check_totals
    where abs(unreconciled_zar) > 1
       or abs(shares_pct - 100) > 0.01

)

select * from final
