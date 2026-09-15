-- Silver: the order-level cost and rebate allocations, one row per order.
-- Resolves defect 6 (thousand separators, here in rebate_amount).

with source as (

    select * from {{ ref('br_cost_allocations') }}

),

cleaned as (

    select
        {{ clean_text('order_id') }} as order_id,
        {{ parse_money('freight_cost') }} as freight_cost_zar,
        {{ parse_money('handling_cost') }} as handling_cost_zar,
        -- Defect 6: rebate_amount is sometimes written with thousand separators, e.g. "1,234.50".
        -- A plain cast turns those into nulls, which would understate the rebate the business
        -- actually pays away and flatter net margin.
        {{ parse_money('rebate_amount') }} as rebate_amount_zar
    from source

),

final as (

    select
        order_id,
        freight_cost_zar,
        handling_cost_zar,
        rebate_amount_zar
    from cleaned

)

select * from final
