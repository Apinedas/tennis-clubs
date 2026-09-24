-- Rate catalog: assignment beyond a single court (by surface, or the whole
-- club), a service dimension reusing booking_type, an active toggle, and a
-- currency-agnostic price now that club.currency exists.

alter table public.rate rename column price_cop to price_amount;

alter table public.rate
  add column surface public.court_surface,
  add column service public.booking_type,
  add column active boolean not null default true;

-- category: null now means "applies to every category" (member and
-- non_member alike), the same convention court_id already uses for "every
-- court". It was the only NOT NULL dimension left forcing every rate to
-- pick a side.
alter table public.rate alter column category drop not null;

-- A rate targets one court, OR every court of a given surface, OR every
-- court in the club — never a court AND a surface at once.
alter table public.rate
  add constraint rate_court_or_surface_not_both
  check (court_id is null or surface is null);
