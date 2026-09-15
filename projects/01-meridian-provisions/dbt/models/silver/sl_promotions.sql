-- Silver: the promotion calendar, one row per promotion.
-- No planted defects here; typed and trimmed so promotion windows can be compared
-- against the order dates they were meant to influence.

with source as (

    select * from {{ ref('br_promotions') }}

),

cleaned as (

    select
        {{ clean_text('promo_id') }} as promo_id,
        {{ clean_text('promo_name') }} as promo_name,
        {{ clean_text('sku') }} as sku,
        {{ clean_text('mechanic') }} as mechanic,
        {{ parse_mixed_date('start_date') }} as start_date,
        {{ parse_mixed_date('end_date') }} as end_date,
        -- Note the scale: the source states this one as a fraction (0.15 means 15%), unlike
        -- sl_order_lines.discount_pct which is stated 0-100. Both are kept as the source
        -- records them; converting silently here would hide the inconsistency.
        try_cast(trim(planned_discount_pct::varchar) as double) as planned_discount_pct,
        {{ clean_text('funding_source') }} as funding_source
    from source

),

final as (

    select
        promo_id,
        promo_name,
        sku,
        mechanic,
        start_date,
        end_date,
        planned_discount_pct,
        funding_source
    from cleaned

)

select * from final
