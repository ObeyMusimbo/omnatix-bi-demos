{#
  Generic tests.

  dbt_utils would give us accepted_range, but none of the four demos vendors a package and
  the point of that is that a prospect can clone the repo and build it with nothing but dbt
  and DuckDB. So the one test we actually need is written here. It is about fifteen lines.

  Usage matches dbt_utils, so swapping to the package later changes nothing but the prefix:

      - accepted_range:
          arguments:
            min_value: 0
            max_value: 1
            inclusive: true
#}

{% test accepted_range(model, column_name, min_value=none, max_value=none, inclusive=true) %}

with violations as (

    select {{ column_name }} as offending_value
    from {{ model }}
    where {{ column_name }} is not null
      and (
        false
        {% if min_value is not none %}
          or {{ column_name }} {{ '<' if inclusive else '<=' }} {{ min_value }}
        {% endif %}
        {% if max_value is not none %}
          or {{ column_name }} {{ '>' if inclusive else '>=' }} {{ max_value }}
        {% endif %}
      )

)

select * from violations

{% endtest %}


{#
  Asserts a model has at least one row. A mart that silently returns nothing is the quietest
  way for a dashboard to go wrong: every chart renders, every total is zero, and nothing
  anywhere says so.
#}
{% test not_empty(model) %}

select 1 as failure
from (select count(*) as n from {{ model }})
where n = 0

{% endtest %}
