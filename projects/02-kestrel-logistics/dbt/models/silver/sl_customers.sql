-- Silver: consignees.
--
-- Resolves defect 5: the same business is booked in more than once, differing only by stray
-- whitespace or whether somebody typed the '(Pty) Ltd'. Left alone, a customer's failure rate
-- and spend get split across two rows and neither looks bad enough to act on.
--
-- customer_name is the cleaned label to display. customer_group is what to aggregate on.

with source as (

    select * from {{ ref('br_customers') }}

),

final as (

    select
        {{ clean_text('customer_id') }} as customer_id,
        {{ clean_text('customer_name') }} as customer_name,
        -- Defect 5: trailing suffix and whitespace stripped so one business is one group.
        {{ normalise_company(clean_text('customer_name')) }} as customer_group,
        {{ clean_text('sector') }} as sector,
        {{ clean_text('contract_type') }} as contract_type,
        {{ clean_text('home_depot_code') }} as home_depot_code,
        -- The window a consignment has to be delivered inside before it counts as late.
        try_cast(sla_hours as integer) as sla_hours,
        try_cast(billing_terms_days as integer) as billing_terms_days,
    from source

)

select * from final
