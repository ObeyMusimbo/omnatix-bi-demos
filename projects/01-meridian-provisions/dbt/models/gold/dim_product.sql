-- dim_product
--
-- The product master as the business should read it: one row per SKU, cleaned attributes
-- carried through from silver, plus the one derived flag the margin story needs.

with products as (

    select * from {{ ref('sl_products') }}

),

final as (

    select
        sku,
        product_name,
        brand,
        category,
        subcategory,
        pack_size,
        weight_kg,
        unit_cost_zar,
        unit_cost_is_imputed,
        list_price_zar,
        status,
        is_discontinued,
        launch_date,
        -- Cascade Springs is the whole bulk bottled water range. It is called out as a flag
        -- because it is heavy, low value per kilogram, and therefore the range where
        -- weight-based freight allocation changes the answer completely.
        brand = 'Cascade Springs' as is_bulk_water,
    from products

)

select * from final
