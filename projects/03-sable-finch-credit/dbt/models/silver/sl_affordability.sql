-- Silver: the National Credit Act affordability assessment recorded at origination.
--
-- This is the most consequential file in the warehouse. Section 81 of the Act obliges the
-- lender to establish that the client can service the loan; a credit agreement entered into
-- without that assessment is reckless, and a court may set aside the consumer's obligations
-- entirely. So a loan written with nothing left after the instalment is not a bad decision,
-- it is an unenforceable contract.

with source as (

    select * from {{ ref('br_affordability') }}

),

final as (

    select
        {{ clean_text('assessment_id') }} as assessment_id,
        {{ clean_text('loan_id') }} as loan_id,
        {{ parse_mixed_date('assessed_at') }} as assessed_at,
        {{ clean_text('assessor_agent_id') }} as assessor_agent_id,
        {{ parse_decimal('declared_gross_income_zar') }} as declared_gross_income_zar,
        {{ parse_decimal('declared_net_income_zar') }} as declared_net_income_zar,
        {{ parse_decimal('declared_expenses_zar') }} as declared_expenses_zar,
        {{ parse_decimal('existing_obligations_zar') }} as existing_obligations_zar,
        -- The minimum monthly expense the regulations require the lender to assume for this
        -- income band, whatever the client claims to spend.
        {{ parse_decimal('regulated_expense_norm_zar') }} as regulated_expense_norm_zar,
        {{ parse_decimal('disposable_income_zar') }} as disposable_income_zar,
        {{ parse_decimal('disposable_after_instalment_zar') }} as disposable_after_instalment_zar,
        -- Nothing left after the instalment. The loan should not have been written.
        {{ parse_decimal('disposable_after_instalment_zar') }} < {{ var('affordability_floor_zar') }}
            as breaches_affordability_floor,
        -- Under R500 of headroom is not a breach, but it is one unexpected expense away from
        -- one, and it is where the next cohort of arrears comes from.
        {{ parse_decimal('disposable_after_instalment_zar') }}
            between {{ var('affordability_floor_zar') }} and 500 as is_marginal,
    from source

)

select * from final
