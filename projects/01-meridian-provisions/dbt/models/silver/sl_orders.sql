-- Silver: order headers, one row per order.
-- Resolves defect 1 (mixed date formats) and defect 9 (cancelled orders).

with source as (

    select * from {{ ref('br_orders') }}

),

cleaned as (

    select
        {{ clean_text('order_id') }} as order_id,
        -- Defect 1: roughly 30% of order dates are written DD/MM/YYYY and the rest ISO.
        -- A plain cast silently nulls the DD/MM ones, which would quietly delete about a
        -- third of the trading history; the macro reads both shapes.
        {{ parse_mixed_date('order_date') }} as order_date,
        {{ clean_text('customer_id') }} as customer_id,
        {{ clean_text('warehouse_code') }} as warehouse_code,
        {{ clean_text('rep_id') }} as rep_id,
        {{ clean_text('order_status') }} as order_status,
        try_cast(trim(payment_terms_days::varchar) as integer) as payment_terms_days
    from source

),

flagged as (

    select
        order_id,
        order_date,
        customer_id,
        warehouse_code,
        rep_id,
        order_status,
        payment_terms_days,
        -- Defect 9: cancelled orders stay in the table so they can still be counted and
        -- explained, but they are marked here once so that every downstream revenue measure
        -- excludes them the same way instead of each report inventing its own filter.
        (order_status = 'Cancelled') as is_cancelled
    from cleaned

),

final as (

    select
        order_id,
        order_date,
        customer_id,
        warehouse_code,
        rep_id,
        order_status,
        payment_terms_days,
        is_cancelled
    from flagged

)

select * from final
