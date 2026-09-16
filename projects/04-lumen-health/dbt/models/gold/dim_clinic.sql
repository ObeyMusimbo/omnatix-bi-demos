-- One row per site.

select
    clinic_code,
    clinic_name,
    city,
    province,
    consulting_rooms,
    opened_date,
from {{ ref('sl_clinics') }}
