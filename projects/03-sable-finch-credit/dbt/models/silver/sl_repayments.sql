-- Silver: instalment level collection history.
--
-- Resolves defect 3 (double posted receipts), defect 7 (reversals as negative amounts),
-- defect 8 (rows quoting loans absent from the book) and defect 9 (status casing).
--
-- Reversals are kept. A receipt captured and then backed out is a real event with a real
-- effect on the balance, and netting it away at this layer would hide a collections control
-- problem behind a tidier number.

with source as (

    select * from {{ ref('br_repayments') }}

),

known_loans as (

    select loan_id from {{ ref('sl_loans') }}

),

typed as (

    select
        {{ clean_text('payment_id') }} as payment_id,
        {{ clean_text('loan_id') }} as loan_id,
        try_cast(instalment_no as integer) as instalment_no,
        {{ parse_mixed_date('due_date') }} as due_date,
        {{ parse_mixed_date('paid_date') }} as paid_date,
        {{ parse_decimal('amount_due_zar') }} as amount_due_zar,
        -- Defect 4 and 7 together: separators to strip, and a negative amount that means a
        -- reversal rather than a data error.
        {{ parse_decimal('amount_paid_zar') }} as amount_paid_zar,
        {{ clean_text('payment_method') }} as payment_method,
        case lower(trim(status::varchar))
            when 'paid' then 'Paid'
            when 'partial' then 'Partial'
            when 'failed' then 'Failed'
            when 'reversed' then 'Reversed'
        end as status,
        {{ clean_text('failure_reason') }} as failure_reason,
    from source

),

-- Defect 3: a receipt posted twice writes the row twice. Cast before deduplicating, because
-- the copies can differ in how the amount happens to be written.
deduped as (

    select distinct
        payment_id, loan_id, instalment_no, due_date, paid_date,
        amount_due_zar, amount_paid_zar, payment_method, status, failure_reason,
    from typed

),

final as (

    select
        d.payment_id,
        d.loan_id,
        d.instalment_no,
        d.due_date,
        d.paid_date,
        d.amount_due_zar,
        d.amount_paid_zar,
        d.payment_method,
        d.status,
        d.failure_reason,
        d.status = 'Reversed' or d.amount_paid_zar < 0 as is_reversal,
        d.status in ('Failed', 'Partial') as is_shortfall,
        -- The first instalment failing is the strongest early signal a book gives. It usually
        -- means the loan should never have been written, or the debit order was set for the
        -- wrong day.
        d.instalment_no = 1 and d.status in ('Failed', 'Partial') as is_first_payment_default,
        -- Defect 8: about 110 receipts quote a loan that is not in the book. Kept and
        -- flagged, because money that arrived against an unknown account is a reconciliation
        -- problem somebody has to own, not a row to delete.
        k.loan_id is not null as loan_is_known,
    from deduped d
    left join known_loans k on d.loan_id = k.loan_id

)

select * from final
