-- Silver: the month end arrears file from the loan management system.
--
-- Resolves defect 4 (separators in balances) and surfaces defect 10, which is the interesting
-- one: this file and the repayment history are two systems of record and they do not always
-- agree. Roughly 2% of rows carry a days past due figure the payment history does not support.
--
-- Neither side is corrected here. Guessing which system is right would be inventing a fact,
-- and the disagreement is itself worth reporting: it is the reason a lender can hold a board
-- pack and a collections report in the same hand and read two different arrears numbers.

with source as (

    select * from {{ ref('br_arrears_snapshots') }}

),

typed as (

    select
        {{ parse_mixed_date('snapshot_date') }} as snapshot_date,
        {{ clean_text('loan_id') }} as loan_id,
        try_cast(days_past_due as integer) as days_past_due,
        {{ parse_decimal('outstanding_balance_zar') }} as outstanding_balance_zar,
        {{ parse_decimal('arrears_amount_zar') }} as arrears_amount_zar,
        {{ clean_text('arrears_bucket') }} as arrears_bucket,
    from source

),

-- What the payment history implies.
--
-- Days past due is not the count of instalments ever missed, and it is not the shortfall in
-- value either. A borrower three months behind who clears the arrears is current again, and
-- one who overpays to catch up does not build credit against a future miss. It is the run of
-- consecutive instalments outstanding right now, which is what the arrears file is supposed
-- to be reporting.
--
-- Found with gaps and islands: a counter increments on every instalment that cleared, so all
-- the rows sharing a counter value are the unbroken run since the last one that did. A
-- partial payment does not clear an instalment, so only a full payment resets the run.
marked as (

    select
        loan_id,
        due_date,
        status,
        sum(case when status = 'Paid' then 1 else 0 end) over (
            partition by loan_id order by due_date
            rows between unbounded preceding and current row
        ) as settled_run,
    from {{ ref('sl_repayments') }}
    where not is_reversal
      and loan_is_known

),

running as (

    select
        loan_id,
        due_date,
        -- Count the instalments in this run that did not clear. Counting rows and subtracting
        -- one for the leading settled instalment looks equivalent and is not: a loan that has
        -- never paid at all has no leading row to discount, so every unpaid instalment reads
        -- a month better than it is. Summing the unpaid ones directly is right in both cases.
        sum(case when status = 'Paid' then 0 else 1 end) over (
            partition by loan_id, settled_run order by due_date
            rows between unbounded preceding and current row
        ) as consecutive_unpaid,
    from marked

),

-- Each snapshot takes the most recent instalment position at or before its date.
implied as (

    select
        a.snapshot_date,
        a.loan_id,
        r.consecutive_unpaid * 30 as implied_days_past_due,
    from typed a
    asof left join running r
        on a.loan_id = r.loan_id
       and r.due_date <= a.snapshot_date

),

final as (

    select
        t.snapshot_date,
        t.loan_id,
        t.days_past_due,
        t.outstanding_balance_zar,
        t.arrears_amount_zar,
        -- Recomputed from days past due rather than trusted, so the bucket and the number can
        -- never disagree with each other even when the file says otherwise.
        case
            when t.days_past_due <= 0 then 'Current'
            when t.days_past_due <= 30 then '1-30'
            when t.days_past_due <= 60 then '31-60'
            when t.days_past_due <= 90 then '61-90'
            else '90+'
        end as arrears_bucket,
        t.arrears_bucket as reported_bucket,
        i.implied_days_past_due,
        -- Defect 10: the two systems disagree by at least one full bucket.
        abs(coalesce(i.implied_days_past_due, 0) - t.days_past_due) >= 30 as conflicts_with_payment_history,
        t.days_past_due >= 90 as is_npl,
        t.days_past_due >= {{ var('writeoff_dpd') }} as is_writeoff_candidate,
    from typed t
    left join implied i
        on t.snapshot_date = i.snapshot_date
       and t.loan_id = i.loan_id

)

select * from final
