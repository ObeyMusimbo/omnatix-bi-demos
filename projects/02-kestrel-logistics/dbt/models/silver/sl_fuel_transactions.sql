-- Silver: fuel card draws.
--
-- Resolves defect 10 (litres written with a decimal comma), defect 3 (double-swiped cards),
-- and defect 4 (odometer readings captured with a digit missing).
--
-- This file is the only place the real cost of a kilometre is visible, and it arrives against
-- a vehicle and a timestamp rather than against a trip. Joining it back to the work the
-- vehicle was doing is what makes finding 3 possible at all.

with source as (

    select * from {{ ref('br_fuel_transactions') }}

),

typed as (

    select
        {{ clean_text('fuel_txn_id') }} as fuel_txn_id,
        {{ parse_mixed_timestamp('txn_datetime') }} as txn_datetime,
        {{ clean_text('vehicle_id') }} as vehicle_id,
        {{ clean_text('driver_id') }} as driver_id,
        -- Defect 10: the card provider exported from a system with a comma decimal separator
        -- for part of the window, which drops the whole column to text. About 9% of rows.
        {{ parse_decimal('litres') }} as litres,
        {{ parse_decimal('price_per_litre') }} as price_per_litre,
        {{ parse_decimal('cost_zar') }} as cost_zar,
        try_cast(odometer_km as bigint) as odometer_km,
        {{ clean_text('site') }} as site,
    from source

),

-- Defect 3: a card swiped twice at the pump writes the transaction twice. Cast before
-- deduplicating: the two copies can differ in how litres happened to be written, so a
-- distinct over the raw text would leave the pair in place and double the fuel bill.
deduped as (

    select distinct
        fuel_txn_id,
        txn_datetime,
        vehicle_id,
        driver_id,
        litres,
        price_per_litre,
        cost_zar,
        odometer_km,
        site,
    from typed

),

-- Defect 4: an odometer typed in with a digit dropped reads about a tenth of the truth.
-- Flagged rather than corrected, because guessing the intended reading would be inventing
-- data. Anything derived from odometer deltas has to exclude these.
--
-- The test is deliberately "far below the last reading", not merely "below it". A vehicle can
-- draw fuel twice in a day and the two rows can land out of order by a few minutes, which
-- makes a strict monotonic check flag about a sixth of the file as broken. A dropped digit
-- puts the reading at roughly a tenth of the truth, so half the previous reading separates
-- the real capture errors from ordinary clock noise.
with_previous as (

    select
        *,
        max(odometer_km) over (
            partition by vehicle_id
            order by txn_datetime
            rows between unbounded preceding and 1 preceding
        ) as highest_previous_odometer_km,
    from deduped

),

final as (

    select
        fuel_txn_id,
        txn_datetime,
        vehicle_id,
        driver_id,
        litres,
        price_per_litre,
        cost_zar,
        odometer_km,
        coalesce(odometer_km < highest_previous_odometer_km * 0.5, false) as odometer_is_suspect,
        site,
    from with_previous

)

select * from final
