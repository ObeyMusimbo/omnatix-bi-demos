-- One row per driver.

with final as (

    select
        dr.driver_id,
        dr.driver_name,
        dr.depot_code,
        dp.depot_name,
        dr.licence_code,
        dr.hired_date,
    from {{ ref('sl_drivers') }} dr
    left join {{ ref('sl_depots') }} dp on dr.depot_code = dp.depot_code

)

select * from final
