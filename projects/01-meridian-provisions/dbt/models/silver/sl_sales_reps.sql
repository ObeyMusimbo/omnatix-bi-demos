-- Silver: the sales force, one row per representative.
-- No planted defects here; this model exists to type and trim the columns so the
-- territory and team labels join cleanly to orders and customers.

with source as (

    select * from {{ ref('br_sales_reps') }}

),

cleaned as (

    select
        {{ clean_text('rep_id') }} as rep_id,
        {{ clean_text('rep_name') }} as rep_name,
        {{ clean_text('region') }} as region,
        {{ clean_text('team') }} as team
    from source

),

final as (

    select
        rep_id,
        rep_name,
        region,
        team
    from cleaned

)

select * from final
