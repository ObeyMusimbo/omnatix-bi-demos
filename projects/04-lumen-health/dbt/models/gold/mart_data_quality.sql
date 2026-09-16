-- The data quality panel.
--
-- Every row here is a defect that exists in the source drops and survives into the warehouse
-- as a flag rather than a deletion. Publishing it is the point. A dashboard that quietly
-- drops the rows it cannot reconcile is how a practice ends up believing a number that is
-- four per cent short, and a practice manager who can see this list knows exactly which
-- front desk habit to go and change.
--
-- impact_zar is the money the defect touches, not the money it loses. A duplicate claim
-- submission touches the full claim value and loses nothing once it is deduplicated.

with icd as (

    select
        count(*) as rows_affected,
        sum(billed_zar) as impact_zar,
    from {{ ref('sl_encounters') }}
    where icd10_missing

),

orphan_payments as (

    select
        count(*) as rows_affected,
        sum(amount_paid_zar) as impact_zar,
    from {{ ref('sl_patient_payments') }}
    where not appointment_is_known

),

dup_claims as (

    select
        count(*) as rows_affected,
        sum(claimed_zar) as impact_zar,
    from {{ ref('sl_claims') }}
    where was_submitted_twice

),

unmapped as (

    select count(*) as rows_affected, 0.0 as impact_zar
    from {{ ref('sl_appointments') }}
    where status is null

),

dmy_dates as (

    select count(*) as rows_affected, sum({{ parse_decimal('claimed_zar') }}) as impact_zar
    from {{ ref('br_claims') }}
    where position('/' in submitted_at::varchar) > 0

),

site_spelling as (

    select count(*) as rows_affected, 0.0 as impact_zar
    from {{ ref('br_clinics') }}
    where clinic_name::varchar <> trim(clinic_name::varchar)
       or clinic_name::varchar = upper(clinic_name::varchar)

),

status_casing as (

    select count(*) as rows_affected, 0.0 as impact_zar
    from {{ ref('br_appointments') }}
    where status::varchar not in ('Attended', 'No show', 'Cancelled')

),

issues as (

    select 1 as issue_order,
           'Diagnosis code missing on the encounter' as issue,
           'Encounters' as source_table,
           'Row kept and flagged. A missing ICD-10 is one of the reasons a claim comes back, so these are counted rather than filled in.' as treatment,
           rows_affected, impact_zar from icd
    union all
    select 2, 'Payment quotes an appointment that does not exist',
           'Patient payments',
           'Row kept and flagged, excluded from anything attributed to a site. The money is real, the visit it belongs to is not in the file.',
           rows_affected, impact_zar from orphan_payments
    union all
    select 3, 'Claim submitted more than once by the switch',
           'Claims',
           'Deduplicated on claim id in silver. Counting both would double the denied value and overstate the headline.',
           rows_affected, impact_zar from dup_claims
    union all
    select 4, 'Dates exported as DD/MM/YYYY instead of ISO',
           'Claims and sessions',
           'Parsed by a macro that handles both. Left to a default cast, roughly one date in four would land null or in the wrong month.',
           rows_affected, impact_zar from dmy_dates
    union all
    select 5, 'Site name captured in more than one spelling',
           'Clinics',
           'Folded to one spelling for display. Nothing joins on the name, so this affects labels rather than numbers.',
           rows_affected, impact_zar from site_spelling
    union all
    select 6, 'Appointment status captured in mixed case',
           'Appointments',
           'Mapped explicitly through a lookup rather than title cased, so a value nobody expected becomes null and fails a test instead of quietly becoming a fourth status.',
           rows_affected, impact_zar from status_casing
    union all
    select 7, 'Appointment status that did not map to a known state',
           'Appointments',
           'The test above, expressed as a count. It is zero, and it is published anyway: a quality panel that only lists the failures cannot tell you what was checked.',
           rows_affected, impact_zar from unmapped

),

final as (

    select
        issue_order,
        issue,
        source_table,
        treatment,
        rows_affected,
        round(coalesce(impact_zar, 0), 2) as impact_zar,
        rows_affected > 0 as is_present,
    from issues

)

select * from final order by issue_order
