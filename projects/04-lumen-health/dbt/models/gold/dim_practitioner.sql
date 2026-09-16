-- One row per practitioner, with the site and the cost of a session.

select
    p.practitioner_id,
    p.practitioner_name,
    p.discipline,
    p.clinic_code,
    c.clinic_name,
    p.practice_number,
    p.sessional_cost_zar,
    p.joined_date,
from {{ ref('sl_practitioners') }} p
left join {{ ref('sl_clinics') }} c using (clinic_code)
