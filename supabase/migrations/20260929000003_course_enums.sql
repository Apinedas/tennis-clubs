-- New enum values for the Cursos module. Each ALTER TYPE ADD VALUE has to
-- land in a migration that doesn't also use the new value (Postgres won't
-- allow both in the same transaction) — the tables/functions that use
-- these follow in the next migration.

alter type public.club_module_name add value 'courses';
alter type public.booking_type add value 'course';
