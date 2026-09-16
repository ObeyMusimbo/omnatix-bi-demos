-- Bronze: agents exactly as it lands. No renaming, no casting, no filtering.
-- Every correction belongs in silver so the change is visible and testable.

select * from {{ source('sable_raw', 'agents') }}
