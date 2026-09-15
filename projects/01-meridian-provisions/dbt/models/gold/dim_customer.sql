-- dim_customer
--
-- One row per trading account, with the owning sales rep attached and the account rolled up
-- to its parent group. The group is what makes finding 3 visible: a discount that looks
-- unremarkable on any single branch is obvious once the branches are added together.

with customers as (

    select * from {{ ref('sl_customers') }}

),

reps as (

    select * from {{ ref('sl_sales_reps') }}

),

grouped as (

    select
        c.*,
        -- Branch names follow two house conventions:
        --   Modern Trade banners are numbered:  'Baywater Market #03'
        --   Wholesale depots are worded:        'Summit Cash & Carry Depot' / 'Branch' / 'Hub'
        -- Exactly one trailing branch marker is stripped, so 'Apex Depot Depot' collapses to
        -- 'Apex Depot' rather than all the way to 'Apex'.
        -- Independent General Trade and HoReCa shops carry a bare shop number instead
        -- ('Cape Town Kwikshop 41'). That is not a branch marker - those are separate
        -- businesses that happen to be numbered - so bare trailing numbers are left alone.
        trim(
            regexp_replace(
                regexp_replace(c.customer_name, '\s+#\d+$', ''),
                '\s+(Depot|Branch|Hub)$',
                ''
            )
        ) as customer_group,
    from customers c

),

final as (

    select
        g.customer_id,
        g.customer_name,
        g.customer_group,
        g.channel,
        g.region,
        g.city,
        g.credit_terms_days,
        g.rebate_pct,
        g.onboarded_date,
        g.rep_id,
        r.rep_name,
        r.team as rep_team,
        r.region as rep_region,
        -- True where the account is one branch of a multi-branch group.
        g.customer_name <> g.customer_group as is_group_branch,
    from grouped g
    left join reps r
        on g.rep_id = r.rep_id

)

select * from final
