{#
  Cleaning helpers for the silver layer.

  Each one exists because of a specific defect in the source drops. Keeping them as named
  macros rather than inline SQL means the dbt docs site lists the firm's cleaning rules,
  which is worth showing a prospect.
#}

{#
  Timestamps arrive from two systems: the TMS writes ISO (2025-03-14 06:30) and the older
  dispatch export writes DD/MM/YYYY HH:MM. Cast to varchar first, because DuckDB's CSV
  sniffer types the clean columns as TIMESTAMP already and trim() has no overload for one.
#}
{% macro parse_mixed_timestamp(col) %}
  case
    when {{ col }} is null or trim({{ col }}::varchar) = '' then null
    when position('/' in {{ col }}::varchar) > 0
      then try_strptime(trim({{ col }}::varchar), '%d/%m/%Y %H:%M')
    else try_cast(trim({{ col }}::varchar) as timestamp)
  end
{% endmacro %}


{% macro parse_mixed_date(col) %}
  case
    when {{ col }} is null or trim({{ col }}::varchar) = '' then null
    when position('/' in {{ col }}::varchar) > 0
      then try_strptime(trim({{ col }}::varchar), '%d/%m/%Y')::date
    else try_cast(trim({{ col }}::varchar) as date)
  end
{% endmacro %}


{#
  The fuel card export writes decimals with a comma (412,50) for part of the window, so the
  whole column lands as text. Strip any thousands separators, then swap a decimal comma for
  a point. Order matters: a value like 1.234,50 would otherwise be mangled.
#}
{% macro parse_decimal(col) %}
  try_cast(
    case
      when position(',' in trim({{ col }}::varchar)) > 0
       and position('.' in trim({{ col }}::varchar)) = 0
      then replace(replace(trim({{ col }}::varchar), '"', ''), ',', '.')
      else replace(replace(trim({{ col }}::varchar), '"', ''), ',', '')
    end
    as double)
{% endmacro %}


{# Trim, collapse repeated whitespace, and treat empty strings as null. #}
{% macro clean_text(col) %}
  nullif(trim(regexp_replace({{ col }}::varchar, '\s+', ' ', 'g')), '')
{% endmacro %}


{#
  Registrations are captured three ways: 'CA 123-456', 'ca123456', and with leading spaces.
  Normalised to a single canonical form so a vehicle is one vehicle.
#}
{% macro normalise_registration(col) %}
  upper(regexp_replace(trim({{ col }}::varchar), '[^A-Za-z0-9]', '', 'g'))
{% endmacro %}


{#
  Delivery status arrives in three casings. Mapped explicitly rather than title-cased, so an
  unexpected value fails a test instead of silently becoming a new status.
#}
{% macro canonical_status(col) %}
  case lower(trim({{ col }}::varchar))
    when 'delivered' then 'Delivered'
    when 'failed'    then 'Failed'
    when 'returned'  then 'Returned'
    else null
  end
{% endmacro %}


{#
  Customer names carry stray whitespace and an inconsistent '(Pty) Ltd' suffix, so the same
  business appears two or three times. Stripped for grouping; the raw name is kept alongside.
#}
{% macro normalise_company(col) %}
  trim(regexp_replace(
    regexp_replace({{ col }}::varchar, '\s*\(Pty\)\s*Ltd\.?\s*$', '', 'gi'),
    '\s+', ' ', 'g'))
{% endmacro %}
