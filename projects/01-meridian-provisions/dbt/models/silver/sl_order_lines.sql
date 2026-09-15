-- Silver: order lines, one row per line after de-duplication.
-- The busiest model in the layer. Resolves defect 4 (duplicate rows), defect 6 (thousand
-- separators in line_revenue), defect 7 (returns) and defect 8 (orphan SKUs).

with source as (

    select * from {{ ref('br_order_lines') }}

),

cleaned as (

    -- Cast first, dedupe second. Defects 4 and 6 are entangled: the duplicate pairs are NOT
    -- byte-identical in the CSV, they differ only in how line_revenue happens to be written
    -- ('5,597.35' vs 5597.35, and '4,962.60' vs 4962.6). Deduping on the raw text therefore
    -- leaves 260 order_line_ids still doubled up. Parsing money to a double first makes the
    -- two spellings the same number, and only then does the row-level distinct below work.
    select
        {{ clean_text('order_line_id') }} as order_line_id,
        {{ clean_text('order_id') }} as order_id,
        {{ clean_text('sku') }} as sku,
        -- Defect 7: returns arrive as a negative quantity, so this stays signed.
        try_cast(trim(quantity::varchar) as integer) as quantity,
        {{ parse_money('unit_price') }} as unit_price_zar,
        -- Held on the source's 0-100 scale, e.g. 10.29 means 10.29%.
        try_cast(trim(discount_pct::varchar) as double) as discount_pct,
        -- Defect 6: line_revenue is sometimes written with thousand separators, e.g. "1,234.50".
        {{ parse_money('line_revenue') }} as line_revenue_zar,
        -- Most lines carry no promotion; an empty string becomes a proper null here.
        {{ clean_text('promo_id') }} as promo_id
    from source

),

deduped as (

    -- Defect 4: about 0.5% of lines are duplicated across every column, order_line_id
    -- included, so the id alone cannot be the de-duplication key - the whole row is.
    -- 289,646 rows in, 288,205 out.
    select distinct
        order_line_id,
        order_id,
        sku,
        quantity,
        unit_price_zar,
        discount_pct,
        line_revenue_zar,
        promo_id
    from cleaned

),

known_skus as (

    select sku from {{ ref('sl_products') }}

),

flagged as (

    select
        deduped.order_line_id,
        deduped.order_id,
        deduped.sku,
        deduped.quantity,
        deduped.unit_price_zar,
        deduped.discount_pct,
        deduped.line_revenue_zar,
        deduped.promo_id,
        -- Defect 7: returns are genuine business events, not errors, so they are kept and
        -- marked. Filtering them out here would overstate net revenue everywhere downstream.
        (deduped.quantity < 0) as is_return,
        -- Defect 8: about 140 lines quote SKUs (the MP-9xxx range) that are absent from the
        -- product master. An inner join would make that revenue disappear without anyone
        -- noticing, so the lines are kept and marked instead. The deliberately-warning
        -- relationship test in the schema file counts them for you.
        (known_skus.sku is not null) as sku_is_known
    from deduped
    left join known_skus
        on deduped.sku = known_skus.sku

),

final as (

    select
        order_line_id,
        order_id,
        sku,
        quantity,
        unit_price_zar,
        discount_pct,
        line_revenue_zar,
        promo_id,
        is_return,
        sku_is_known
    from flagged

)

select * from final
