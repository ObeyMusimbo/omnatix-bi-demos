/*
  The cost of an empty chair is computed in two places at two different grains, and they have
  to agree.

    fct_session         one row per session, which has a single cost per slot, so
                        slots_unfilled * cost_per_slot is exact.
    mart_capacity_cost  one row per weekday and hour across every clinic and practitioner,
                        so the underlying rate varies within a row.

  They disagreed by R1.75m until this was caught, because the mart averaged the rate over a
  cell and then multiplied by the cell's unfilled count. A slot costs between R129 and R621
  depending on who was rostered, and the expensive practitioners have the emptiest diaries, so
  the unfilled slots are not a random sample of the rate and the average understates them.

  Nothing about that failure was visible on the page. The tile simply read R31.1m instead of
  R32.5m, which is the sort of error a demo ships with forever. Hence a test rather than a
  comment.

  Tolerance is R100 against a R32m figure, which absorbs the per-row rounding in the mart
  without leaving room for a real regression to hide.
*/

with from_sessions as (

    select
        sum(unfilled_cost_zar) as unfilled_zar,
        sum(no_show_cost_zar) as no_show_zar,
    from {{ ref('fct_session') }}

),

from_mart as (

    select distinct
        all_unfilled_cost_zar as unfilled_zar,
        all_no_show_cost_zar as no_show_zar,
    from {{ ref('mart_capacity_cost') }}

),

compared as (

    select
        s.unfilled_zar as session_unfilled_zar,
        m.unfilled_zar as mart_unfilled_zar,
        abs(s.unfilled_zar - m.unfilled_zar) as unfilled_gap_zar,
        s.no_show_zar as session_no_show_zar,
        m.no_show_zar as mart_no_show_zar,
        abs(s.no_show_zar - m.no_show_zar) as no_show_gap_zar,
    from from_sessions s
    cross join from_mart m

)

select * from compared
where unfilled_gap_zar > 100
   or no_show_gap_zar > 100
