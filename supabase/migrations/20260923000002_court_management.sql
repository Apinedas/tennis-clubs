-- Court management: closed surface catalog, plus covered/lighting flags
-- that Bookings will use later to filter availability by weather/time.

create type public.court_surface as enum ('clay', 'hard', 'grass', 'carpet', 'other');

-- `surface` was free text; map the existing demo data (from
-- scripts/seed-dev.mjs) into the new catalog before tightening the column.
alter table public.court add column surface_new public.court_surface;

update public.court set surface_new = case
  when surface ilike 'arcilla%' or surface ilike '%clay%' or surface ilike '%ladrillo%' then 'clay'
  when surface ilike 'cemento%' or surface ilike '%hard%' or surface ilike '%dura%' or surface ilike '%plexicushion%' then 'hard'
  when surface ilike '%grass%' or surface ilike '%c_sped%' then 'grass'
  when surface ilike '%carpet%' or surface ilike '%alfombra%' or surface ilike '%sintetic%' or surface ilike '%sint_tic%' then 'carpet'
  else 'other'
end::public.court_surface;

alter table public.court alter column surface_new set not null;
alter table public.court drop column surface;
alter table public.court rename column surface_new to surface;

alter table public.court
  add column covered boolean not null default false,
  add column has_lighting boolean not null default false,
  add column notes text;
