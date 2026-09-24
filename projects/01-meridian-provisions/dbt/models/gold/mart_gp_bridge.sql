{#
  The closing visual: why gross profit is flat while revenue grows.

  This is a model rather than a calculation in the dashboard on purpose. It is the number
  the demo ends on, so it is defined once, tested, and read identically by the dashboard,
  the answer key, and anything that queries the warehouse later.

  Read the drivers as gross-profit effects against the counterfactual "margin simply held
  at last year's rate". They are deliberately not mutually exclusive to the last cent -
  the residual row absorbs the overlap and the drivers this does not name.

  Every step covers the same trailing twelve months as the gap it explains. The promotion
  and discount steps once summed the whole two year window inside a one year gap, which
  overstated both by about R2.8m between them and understated the residual by the same.
  The windows come from period_end rather than typed dates, so they cannot drift apart.
#}

{%- set ttm_after = "(date '" ~ var('period_end') ~ "' - interval 12 month)::date" -%}
{%- set prior_after = "(date '" ~ var('period_end') ~ "' - interval 24 month)::date" %}

with periods as (

    select
        sum(case when order_date > {{ ttm_after }} then revenue_zar else 0 end) as ttm_revenue,
        sum(case when order_date > {{ ttm_after }} then gross_profit_zar else 0 end) as ttm_gp,
        sum(case when order_date <= {{ ttm_after }} then revenue_zar else 0 end) as prior_revenue,
        sum(case when order_date <= {{ ttm_after }} then gross_profit_zar else 0 end) as prior_gp
    from {{ ref('fct_sales_line') }}
    where order_date > {{ prior_after }}

),

gap as (

    select
        *,
        ttm_gp / nullif(ttm_revenue, 0) * 100 as ttm_margin_pct,
        prior_gp / nullif(prior_revenue, 0) * 100 as prior_margin_pct,
        -- What gross profit would have been had margin held at last year's rate
        ttm_revenue * (prior_gp / nullif(prior_revenue, 0)) as gp_at_prior_margin
    from periods

),

-- Driver 1: units sold on deal below cost, in promotion weeks inside the twelve months.
-- Weeks start on a Monday and 1 September 2025 is one, so no week straddles the boundary.
promo as (

    select sum(gp_forgone_vs_baseline_zar) as effect_zar
    from {{ ref('mart_promo_performance') }}
    where promo_phase = 'On promotion'
      and week_start_date > {{ ttm_after }}

),

-- Driver 2: the largest account's discount drifting upward and never being reset, valued
-- over the twelve months against the rate it opened the window on
discount_creep as (

    select sum(revenue_forgone_vs_baseline_zar) as effect_zar
    from {{ ref('mart_discount_trend') }}
    where customer_group = 'Summit Cash & Carry'
      and month_start_date > {{ ttm_after }}

),

-- Driver 3: mix. The bulk water range did not lose gross profit - its gross profit is
-- positive. It dragged the blended rate down by taking share at a much lower margin.
mix as (

    select
        (
            any_value(case when period_order = 1 then revenue_zar end) / (select ttm_revenue from gap)
            - any_value(case when period_order = 2 then revenue_zar end) / (select prior_revenue from gap)
        )
        * ((select ttm_margin_pct from gap) - any_value(case when period_order = 1 then brand_gross_margin_pct end)) / 100
        * (select ttm_revenue from gap) as effect_zar
    from {{ ref('mart_margin_waterfall') }}
    where brand = 'Cascade Springs'

),

-- driver carries the full sentence for tables and the answer key; driver_short is what fits
-- under a waterfall bar without being truncated.
drivers as (

    select 1 as step_order, 'Gross profit at last year''s margin' as driver,
           'At last year''s margin' as driver_short,
           'anchor' as step_type, (select gp_at_prior_margin from gap) as effect_zar, null as finding_ref
    union all
    select 2, 'Promotion sold below cost', 'Promotions below cost',
           'decrease', -(select effect_zar from promo), '2'
    union all
    select 3, 'Discount creep on the largest account', 'Discount creep',
           'decrease', -(select effect_zar from discount_creep), '3'
    union all
    select 4, 'Bulk water taking share at a low margin', 'Low-margin mix shift',
           'decrease', -(select effect_zar from mix), '1'
    union all
    select 5, 'Other discount drift and mix', 'Other drift and mix', 'decrease',
           -((select gp_at_prior_margin - ttm_gp from gap)
             - (select effect_zar from promo)
             - (select effect_zar from discount_creep)
             - (select effect_zar from mix)), null
    union all
    select 6, 'Actual gross profit', 'Actual gross profit',
           'total', (select ttm_gp from gap), null

),

final as (

    select
        step_order,
        driver,
        driver_short,
        step_type,
        effect_zar,
        finding_ref,
        -- Running total so the dashboard can draw this straight as a waterfall
        case
            when step_type = 'anchor' then effect_zar
            when step_type = 'total' then effect_zar
            else (select gp_at_prior_margin from gap)
                 + sum(case when step_type = 'decrease' then effect_zar else 0 end)
                   over (order by step_order rows between unbounded preceding and current row)
        end as running_total_zar,
        -- Only a step has a share of the gap. The anchor and the total are levels, not
        -- movements, and dividing them by the gap produces a number like -1432% that means
        -- nothing. The page happens to hide it, but the marts are also what will ground the
        -- chat layer, so it is nulled at the source rather than filtered at the surface.
        case when step_type = 'decrease'
             then effect_zar / nullif((select gp_at_prior_margin - ttm_gp from gap), 0) * -100
        end as pct_of_gap,
        (select ttm_revenue from gap) as ttm_revenue_zar,
        (select ttm_gp from gap) as ttm_gross_profit_zar,
        (select prior_revenue from gap) as prior_revenue_zar,
        (select prior_gp from gap) as prior_gross_profit_zar,
        (select ttm_margin_pct from gap) as ttm_margin_pct,
        (select prior_margin_pct from gap) as prior_margin_pct,
        (select gp_at_prior_margin - ttm_gp from gap) as total_gap_zar
    from drivers

)

select * from final order by step_order
