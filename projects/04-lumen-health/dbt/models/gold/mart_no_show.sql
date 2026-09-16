{#
  Who does not arrive, and what would change it.

  Two dimensions, and the interaction between them is the finding. How far ahead the booking
  was made, and whether a reminder went out. Read singly, either one looks like a modest
  effect. Crossed, the best cell and the worst cell are five times apart.

  The recoverable column is the only number here anyone should act on, and it is built to be
  conservative on purpose. Within each lead band it asks what the no-show rate already is for
  the bookings in that band that did get a reminder, and applies that rate to the ones that
  did not. So the claim is never 'reminders would fix no-shows'. It is 'the bookings in this
  band that got a reminder behaved this way, and these ones were not given the chance'.
  Nothing is assumed about patients moving to a shorter lead time, which is a second and much
  larger effect that this model does not claim.
#}

with by_cell as (

    select
        booking_lead_band,
        booking_lead_order,
        reminder_sent,
        count(*) as appointments,
        count(*) filter (where is_no_show) as no_shows,
        count(*) filter (where is_attended) as attended,
        avg(booking_lead_days) as avg_lead_days,
    from {{ ref('fct_appointment') }}
    where booking_lead_band is not null
      and reminder_sent is not null
    group by all

),

reminded_rate as (

    select
        booking_lead_band,
        no_shows::double / nullif(appointments, 0) as reminded_no_show_rate,
    from by_cell
    where reminder_sent

),

value as (

    -- What a visit is worth, measured rather than assumed: the average billed on visits that
    -- did happen. A no-show is this much revenue that did not get raised.
    select avg(billed_zar) as revenue_per_visit_zar
    from {{ ref('fct_appointment') }}
    where is_attended and billed_zar is not null

),

scored as (

    select
        c.booking_lead_band,
        c.booking_lead_order,
        c.reminder_sent,
        c.appointments,
        c.no_shows,
        c.attended,
        round(c.avg_lead_days, 1) as avg_lead_days,
        round(100.0 * c.no_shows / nullif(c.appointments, 0), 1) as no_show_pct,
        round(100.0 * r.reminded_no_show_rate, 1) as reminded_benchmark_pct,
        case
            when c.reminder_sent then 0
            else greatest(0, c.no_shows - c.appointments * r.reminded_no_show_rate)
        end as recoverable_visits,
    from by_cell c
    left join reminded_rate r using (booking_lead_band)

),

totals as (

    select
        sum(appointments) as all_appointments,
        sum(no_shows) as all_no_shows,
        sum(recoverable_visits) as all_recoverable_visits,
        sum(appointments) filter (where not reminder_sent) as unreminded_appointments,
    from scored

),

final as (

    select
        s.booking_lead_band,
        s.booking_lead_order,
        s.reminder_sent,
        s.appointments,
        s.no_shows,
        s.attended,
        s.avg_lead_days,
        s.no_show_pct,
        s.reminded_benchmark_pct,
        round(s.recoverable_visits) as recoverable_visits,
        round(s.recoverable_visits * v.revenue_per_visit_zar, 2) as recoverable_zar,

        round(v.revenue_per_visit_zar, 2) as revenue_per_visit_zar,
        t.all_appointments,
        t.all_no_shows,
        t.unreminded_appointments,
        round(100.0 * t.all_no_shows / nullif(t.all_appointments, 0), 1) as all_no_show_pct,
        round(100.0 * t.unreminded_appointments / nullif(t.all_appointments, 0), 1)
            as unreminded_pct,
        round(t.all_recoverable_visits) as all_recoverable_visits,
        round(t.all_recoverable_visits * v.revenue_per_visit_zar, 2) as all_recoverable_zar,
        round(t.all_no_shows * v.revenue_per_visit_zar, 2) as all_no_show_revenue_zar,

    from scored s
    cross join totals t
    cross join value v

)

select * from final order by booking_lead_order, reminder_sent
