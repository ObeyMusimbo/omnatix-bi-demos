{#
  What the empty half of the diary costs.

  A session is bought whole, so every slot inside it is paid for whether or not somebody sits
  in it. This model puts a rand figure on the slots nobody sat in, and splits it by why the
  chair was empty, because the two halves have nothing to do with each other:

    Never booked   no patient ever wanted that slot. The fix is the roster.
    Booked, no show  a patient wanted it and did not arrive. The fix is a text message.

  The excess column is the one to be careful with, and it is deliberately conservative. It
  does not assume a single patient moves. For each cell it asks how much capacity a diary
  running at the target fill rate would need to serve that cell's own demand, and calls
  anything above that excess. A cell already at or above target contributes nothing. So the
  total is what the roster is carrying beyond what today's demand, exactly where it already
  falls, would require.

  The target is a variable and it is not 100%. A diary with no slack cannot take an urgent
  case, and a practice that books to the last slot is the practice with the thirty minute
  waits further down this page.
#}

{% set target = var('target_fill_rate') %}

with cells as (

    select
        day_of_week,
        slot_hour,
        sum(slots_offered) as slots_offered,
        sum(slots_booked) as slots_booked,
        sum(slots_attended) as slots_attended,
        sum(slots_no_show) as slots_no_show,
        sum(slots_unfilled) as slots_unfilled,
        sum(capacity_cost_zar) as capacity_cost_zar,
        sum(capacity_cost_zar) / nullif(sum(slots_offered), 0) as cost_per_slot_zar,
    from {{ ref('fct_capacity_hour') }}
    group by all

),

scored as (

    select
        *,
        slots_booked::double / nullif(slots_offered, 0) as fill_rate,
        -- Capacity a diary at the target would need for this cell's own demand.
        least(slots_offered, ceil(slots_booked / {{ target }})) as slots_needed,
        greatest(0, slots_offered - ceil(slots_booked / {{ target }})) as slots_excess,
    from cells

),

totals as (

    select
        sum(slots_offered) as all_slots,
        sum(slots_booked) as all_booked,
        sum(slots_unfilled) as all_unfilled,
        sum(slots_no_show) as all_no_show,
        sum(capacity_cost_zar) as all_cost_zar,
        sum(slots_unfilled * cost_per_slot_zar) as all_unfilled_cost_zar,
        sum(slots_no_show * cost_per_slot_zar) as all_no_show_cost_zar,
        sum(slots_excess * cost_per_slot_zar) as all_excess_cost_zar,
        sum(slots_excess) as all_excess_slots,
    from scored

),

final as (

    select
        s.day_of_week,
        d.day_short,
        s.slot_hour,
        lpad(s.slot_hour::varchar, 2, '0') || ':00' as slot_label,
        s.slots_offered,
        s.slots_booked,
        s.slots_unfilled,
        s.slots_no_show,
        s.slots_excess::bigint as slots_excess,
        round(s.fill_rate * 100, 1) as fill_pct,
        round(s.cost_per_slot_zar, 2) as cost_per_slot_zar,
        round(s.capacity_cost_zar, 2) as capacity_cost_zar,
        round(s.slots_unfilled * s.cost_per_slot_zar, 2) as unfilled_cost_zar,
        round(s.slots_no_show * s.cost_per_slot_zar, 2) as no_show_cost_zar,
        round(s.slots_excess * s.cost_per_slot_zar, 2) as excess_cost_zar,

        {{ target }} * 100 as target_fill_pct,
        t.all_slots,
        t.all_booked,
        t.all_unfilled,
        t.all_no_show,
        round(t.all_cost_zar, 2) as all_cost_zar,
        round(t.all_unfilled_cost_zar, 2) as all_unfilled_cost_zar,
        round(t.all_no_show_cost_zar, 2) as all_no_show_cost_zar,
        round(t.all_excess_cost_zar, 2) as all_excess_cost_zar,
        t.all_excess_slots::bigint as all_excess_slots,
        round(100.0 * t.all_booked / nullif(t.all_slots, 0), 1) as all_fill_pct,
        round(100.0 * (t.all_unfilled + t.all_no_show) / nullif(t.all_slots, 0), 1)
            as all_empty_pct,

    from scored s
    cross join totals t
    left join (select distinct day_of_week, day_short from {{ ref('dim_date') }}) d
        using (day_of_week)

)

select * from final order by day_of_week, slot_hour
