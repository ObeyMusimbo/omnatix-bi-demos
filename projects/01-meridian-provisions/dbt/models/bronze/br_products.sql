-- Bronze: products exactly as it lands. No renaming, no casting, no filtering.
-- Every correction belongs in silver so the change is visible and testable.

select * from {{ source('meridian_raw', 'products') }}
