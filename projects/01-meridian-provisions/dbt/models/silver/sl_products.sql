-- Silver: the product master, one row per SKU.
-- Resolves defect 2 (stray whitespace on category) and defect 5 (blank unit_cost).

with source as (

    select * from {{ ref('br_products') }}

),

cleaned as (

    select
        {{ clean_text('sku') }} as sku,
        {{ clean_text('product_name') }} as product_name,
        {{ clean_text('brand') }} as brand,
        -- Defect 2: category arrives with leading and trailing whitespace ('  Beverages',
        -- 'Beverages '). Left alone it splits one real category into three in every
        -- downstream group by, and the category ratio below would be computed off the wrong set.
        {{ clean_text('category') }} as category,
        {{ clean_text('subcategory') }} as subcategory,
        {{ clean_text('pack_size') }} as pack_size,
        try_cast(trim(weight_kg::varchar) as double) as weight_kg,
        {{ parse_money('unit_cost') }} as unit_cost_zar,
        {{ parse_money('list_price') }} as list_price_zar,
        {{ clean_text('status') }} as status,
        {{ parse_mixed_date('launch_date') }} as launch_date
    from source

),

category_cost_ratio as (

    -- Defect 5, part 1: work out what cost normally looks like as a share of list price,
    -- per category. Median rather than mean so one unusual product cannot drag the estimate,
    -- and per category because margin differs a lot between Beverages and Personal Care.
    select
        category,
        median(unit_cost_zar / list_price_zar) as cost_to_list_ratio
    from cleaned
    where unit_cost_zar is not null
      and list_price_zar > 0
    group by category

),

imputed as (

    -- Defect 5, part 2: seven products ship with a blank unit_cost. Rather than drop them or
    -- let them poison margin as nulls, fill the gap with the category ratio applied to the
    -- product's own list price, rounded to the cent, and flag every row that was filled so no
    -- one downstream mistakes an estimate for a measured cost.
    select
        cleaned.sku,
        cleaned.product_name,
        cleaned.brand,
        cleaned.category,
        cleaned.subcategory,
        cleaned.pack_size,
        cleaned.weight_kg,
        coalesce(
            cleaned.unit_cost_zar,
            round(cleaned.list_price_zar * category_cost_ratio.cost_to_list_ratio, 2)
        ) as unit_cost_zar,
        (cleaned.unit_cost_zar is null) as unit_cost_is_imputed,
        cleaned.list_price_zar,
        cleaned.status,
        (cleaned.status = 'Discontinued') as is_discontinued,
        cleaned.launch_date
    from cleaned
    left join category_cost_ratio
        on cleaned.category = category_cost_ratio.category

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
        launch_date
    from imputed

)

select * from final
