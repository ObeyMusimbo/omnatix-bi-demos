-- One row per payer.
--
-- tariff_factor is the share of the practice tariff the scheme settles. One minus that is
-- the gap somebody at reception has to ask the patient for, which is where finding 5 lives.

select
    scheme_code,
    scheme_name,
    payment_terms_days,
    tariff_factor,
    round((1 - tariff_factor) * 100, 1) as gap_pct_of_tariff,
    is_self_funded,
from {{ ref('sl_schemes') }}
