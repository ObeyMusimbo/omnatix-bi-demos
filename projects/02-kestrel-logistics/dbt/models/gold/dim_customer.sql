-- One row per consignee.
--
-- customer_id is the aggregation key. customer_group exists only to give a clean display
-- label with the inconsistent Pty Ltd suffix stripped; it is not a merge key, because every
-- customer_id here is a separate business.

with final as (

    select
        c.customer_id,
        c.customer_name,
        c.customer_group,
        c.sector,
        c.contract_type,
        c.home_depot_code,
        d.depot_name as home_depot_name,
        c.sla_hours,
        c.billing_terms_days,
        -- The one account with a service penalty clause in its contract. Finding 4 prices it.
        c.customer_group = 'Highveld Retail Group' as is_anchor_account,
    from {{ ref('sl_customers') }} c
    left join {{ ref('sl_depots') }} d on c.home_depot_code = d.depot_code

)

select * from final
