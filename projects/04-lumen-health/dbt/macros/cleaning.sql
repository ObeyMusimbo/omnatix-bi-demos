{#
  Cleaning helpers for the silver layer.

  Each one exists because of a specific defect in the source drops. Keeping them as named
  macros rather than inline SQL means the dbt docs site lists the practice's cleaning rules,
  which is worth showing a prospect.
#}

{#
  Timestamps arrive ISO from the practice management system. Cast to varchar first, because
  DuckDB's CSV sniffer types the clean columns as TIMESTAMP already and trim() has no
  overload for one.
#}
{% macro parse_mixed_timestamp(col) %}
  case
    when {{ col }} is null or trim({{ col }}::varchar) = '' then null
    when position('/' in {{ col }}::varchar) > 0
      then try_strptime(trim({{ col }}::varchar), '%d/%m/%Y %H:%M')
    else try_cast(trim({{ col }}::varchar) as timestamp)
  end
{% endmacro %}


{#
  The session diary and the claims switch disagree about dates: one writes ISO, the other
  DD/MM/YYYY. Both appear in the same column.
#}
{% macro parse_mixed_date(col) %}
  case
    when {{ col }} is null or trim({{ col }}::varchar) = '' then null
    when position('/' in {{ col }}::varchar) > 0
      then try_strptime(trim({{ col }}::varchar), '%d/%m/%Y')::date
    else try_cast(trim({{ col }}::varchar) as date)
  end
{% endmacro %}


{#
  Billed amounts above a thousand rand are sometimes exported with thousands separators and
  wrapped in quotes, so the whole column lands as text. Strip the separators before casting.
#}
{% macro parse_decimal(col) %}
  try_cast(
    replace(replace(trim({{ col }}::varchar), '"', ''), ',', '')
    as double)
{% endmacro %}


{# Trim, collapse repeated whitespace, and treat empty strings as null. #}
{% macro clean_text(col) %}
  nullif(trim(regexp_replace({{ col }}::varchar, '\s+', ' ', 'g')), '')
{% endmacro %}


{#
  Site names are captured by hand at each front desk, so the same clinic appears as
  'Lumen Sandton', 'LUMEN SANDTON' and '  Lumen Sandton'. Folded to one spelling for
  display. The site code is what anything joins on.
#}
{% macro canonical_site_name(col) %}
  array_to_string(
    list_transform(
      string_split(lower({{ clean_text(col) }}), ' '),
      w -> upper(w[1]) || w[2:]
    ), ' ')
{% endmacro %}


{#
  Appointment status arrives in three casings. Mapped explicitly rather than title-cased, so
  an unexpected value fails a test instead of silently becoming a new status.
#}
{% macro canonical_appointment_status(col) %}
  case lower(trim({{ col }}::varchar))
    when 'attended'  then 'Attended'
    when 'no show'   then 'No show'
    when 'cancelled' then 'Cancelled'
    else null
  end
{% endmacro %}


{#
  Claim status, same treatment. 'Paid on resubmission' is a separate state from 'Paid' on
  purpose: the money arrived either way, but only one of them cost somebody a rework.
#}
{% macro canonical_claim_status(col) %}
  case lower(trim({{ col }}::varchar))
    when 'paid'                 then 'Paid'
    when 'paid on resubmission' then 'Paid on resubmission'
    when 'short paid'           then 'Short paid'
    when 'rejected'             then 'Rejected'
    else null
  end
{% endmacro %}


{# A yes or no flag captured as a single character. #}
{% macro yn_flag(col) %}
  case upper(trim({{ col }}::varchar)) when 'Y' then true when 'N' then false else null end
{% endmacro %}
