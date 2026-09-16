-- Silver: medical schemes.
--
-- tariff_factor is what the scheme pays against the practice tariff. The remainder is the
-- patient's gap, and collecting it is somebody's job at reception. Self funded patients are
-- carried here as a scheme with a factor of one so every visit has a payer.

with final as (
    select
        {{ clean_text('scheme_code') }} as scheme_code,
        {{ clean_text('scheme_name') }} as scheme_name,
        try_cast(payment_terms_days as integer) as payment_terms_days,
        try_cast(tariff_factor as double) as tariff_factor,
        {{ clean_text('scheme_code') }} = 'SELF' as is_self_funded,
    from {{ ref('br_schemes') }}
)
select * from final
