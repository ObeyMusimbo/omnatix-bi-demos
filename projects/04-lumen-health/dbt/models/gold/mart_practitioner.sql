{#
  One row per practitioner.

  The comparison that matters is within a discipline, never across one. A radiologist and a
  dietician are bought at different prices and see patients at different rates, so ranking
  them on the same list produces a league table that says nothing except which discipline is
  expensive.

  So every ratio here is also expressed against the median of that practitioner's own
  discipline. cost_per_attended_zar is the honest efficiency number: what the group paid in
  sessional cost for each patient who actually sat down. A practitioner whose diary is half
  empty costs roughly twice as much per patient as the one next door on the same rate.

  Note what is not implied. A low fill rate is not a judgement about the clinician. It is
  usually a statement about when they were rostered, which is the roster's problem and is why
  this page puts the weekday grid first.
#}

with capacity as (

    select
        practitioner_id,
        count(*) as sessions,
        sum(slots_offered) as slots_offered,
        sum(slots_booked) as slots_booked,
        sum(slots_attended) as slots_attended,
        sum(slots_no_show) as slots_no_show,
        sum(sessional_cost_zar) as sessional_cost_zar,
        sum(billed_zar) as billed_zar,
        avg(avg_wait_minutes) as avg_wait_minutes,
    from {{ ref('fct_session') }}
    group by all

),

scored as (

    select
        c.practitioner_id,
        p.practitioner_name,
        p.discipline,
        p.clinic_code,
        p.clinic_name,
        p.sessional_cost_zar as session_rate_zar,
        c.sessions,
        c.slots_offered,
        c.slots_booked,
        c.slots_attended,
        c.slots_no_show,
        c.sessional_cost_zar,
        c.billed_zar,
        c.avg_wait_minutes,
        c.slots_booked::double / nullif(c.slots_offered, 0) * 100 as fill_pct,
        c.slots_attended::double / nullif(c.slots_offered, 0) * 100 as attended_pct,
        c.sessional_cost_zar / nullif(c.slots_attended, 0) as cost_per_attended_zar,
        c.billed_zar / nullif(c.sessional_cost_zar, 0) as billed_per_cost_rand,
    from capacity c
    join {{ ref('dim_practitioner') }} p using (practitioner_id)

),

peer as (

    select
        discipline,
        count(*) as peers,
        median(fill_pct) as peer_median_fill_pct,
        median(cost_per_attended_zar) as peer_median_cost_per_attended_zar,
    from scored
    group by all

),

final as (

    select
        s.practitioner_id,
        s.practitioner_name,
        s.discipline,
        s.clinic_code,
        s.clinic_name,
        round(s.session_rate_zar, 2) as session_rate_zar,
        s.sessions,
        s.slots_offered,
        s.slots_booked,
        s.slots_attended,
        s.slots_no_show,
        round(s.sessional_cost_zar, 2) as sessional_cost_zar,
        round(s.billed_zar, 2) as billed_zar,
        round(s.fill_pct, 1) as fill_pct,
        round(s.attended_pct, 1) as attended_pct,
        round(s.cost_per_attended_zar, 2) as cost_per_attended_zar,
        round(s.billed_per_cost_rand, 2) as billed_per_cost_rand,
        round(s.avg_wait_minutes, 1) as avg_wait_minutes,
        p.peers,
        round(p.peer_median_fill_pct, 1) as peer_median_fill_pct,
        round(p.peer_median_cost_per_attended_zar, 2) as peer_median_cost_per_attended_zar,
        round(s.fill_pct - p.peer_median_fill_pct, 1) as fill_pct_vs_peers,
        round(s.cost_per_attended_zar / nullif(p.peer_median_cost_per_attended_zar, 0), 2)
            as cost_ratio_vs_peers,
    from scored s
    left join peer p using (discipline)

)

select * from final order by discipline, fill_pct desc
