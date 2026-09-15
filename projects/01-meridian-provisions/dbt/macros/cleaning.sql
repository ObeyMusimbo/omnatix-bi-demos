{#
  Cleaning helpers for the silver layer.

  Each one exists because of a specific defect in the source drops. Keeping them as named
  macros rather than inline SQL means the dbt docs site lists the firm's cleaning rules,
  which is worth showing a prospect.
#}

{#
  Source dates arrive as a mix of ISO (2025-03-14) and DD/MM/YYYY (14/03/2025).

  Only orders.order_date is actually mixed. The other date columns are clean enough that
  DuckDB's CSV sniffer types them as DATE already, so this is applied to them defensively.
  That means the input can be either VARCHAR or DATE, hence the explicit ::varchar cast —
  without it, trim() has no candidate overload for a DATE and the model fails to bind.
#}
{% macro parse_mixed_date(col) %}
  case
    when {{ col }} is null or trim({{ col }}::varchar) = '' then null
    when position('/' in {{ col }}::varchar) > 0 then try_strptime(trim({{ col }}::varchar), '%d/%m/%Y')::date
    else try_cast(trim({{ col }}::varchar) as date)
  end
{% endmacro %}


{# Large amounts are sometimes written with thousand separators, e.g. 1,234.50 #}
{% macro parse_money(col) %}
  try_cast(replace(replace(trim({{ col }}::varchar), ',', ''), '"', '') as double)
{% endmacro %}


{# Trim, collapse repeated whitespace, and treat empty strings as null. #}
{% macro clean_text(col) %}
  nullif(trim(regexp_replace({{ col }}::varchar, '\s+', ' ', 'g')), '')
{% endmacro %}


{#
  Channel arrives in three casings (Modern Trade / MODERN TRADE / modern trade).
  Mapped explicitly rather than title-cased, so that an unexpected value fails a test
  instead of silently becoming a new channel.
#}
{% macro canonical_channel(col) %}
  case lower(trim({{ col }}::varchar))
    when 'modern trade'  then 'Modern Trade'
    when 'general trade' then 'General Trade'
    when 'wholesale'     then 'Wholesale'
    when 'horeca'        then 'HoReCa'
    else null
  end
{% endmacro %}
