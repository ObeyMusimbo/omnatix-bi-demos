-- Silver: claims to the medical schemes.
--
-- The claims switch retries on a timer and occasionally sends the same claim twice, which is
-- why 'Duplicate claim' is one of the rejection reasons in the file. A duplicate is a
-- transport artefact, not a second claim, so the row is deduplicated on claim_id here.
-- Deduplicating later would double count the denied value and overstate the headline.
--
-- days_to_settle is measured from submission to payment, not from date of service, so a slow
-- scheme and a slow practice stay two different numbers.

with parsed as (

    select
        {{ clean_text('claim_id') }} as claim_id,
        {{ clean_text('appointment_id') }} as appointment_id,
        {{ clean_text('scheme_code') }} as scheme_code,
        {{ parse_mixed_date('submitted_at') }} as submitted_at,
        {{ parse_decimal('claimed_zar') }} as claimed_zar,
        {{ parse_decimal('paid_zar') }} as paid_zar,
        {{ canonical_claim_status('status') }} as status,
        {{ clean_text('rejection_reason') }} as rejection_reason,
        {{ yn_flag('resubmitted') }} as resubmitted,
        {{ parse_mixed_date('paid_at') }} as paid_at,
    from {{ ref('br_claims') }}

),

ranked as (

    select
        *,
        row_number() over (
            partition by claim_id
            order by coalesce(paid_at, date '9999-12-31'), submitted_at
        ) as dup_rank,
        count(*) over (partition by claim_id) as submission_count,
    from parsed

),

final as (

    select
        claim_id,
        appointment_id,
        scheme_code,
        submitted_at,
        claimed_zar,
        paid_zar,
        status,
        rejection_reason,
        resubmitted,
        paid_at,
        submission_count,
        submission_count > 1 as was_submitted_twice,
        status in ('Paid', 'Paid on resubmission') as is_settled_in_full,
        status in ('Rejected', 'Short paid') as is_outstanding,
        round(claimed_zar - paid_zar, 2) as shortfall_zar,
        case
            when paid_at is null or submitted_at is null then null
            else date_diff('day', submitted_at, paid_at)
        end as days_to_settle,
        date_trunc('month', submitted_at)::date as submitted_month,
    from ranked
    where dup_rank = 1

)

select * from final
