-- Public microsite: a club's identity, courts, coaches and rates need to be
-- readable by anon (no session at all) — none of the underlying tables
-- allow that today, so this is entirely new narrow, read-only RPCs, plus
-- one column public_club was missing.

alter table public.club add column address text;

-- public_club already existed (used by /register and /join); its shape
-- changes, so drop + recreate rather than replace.
drop function public.public_club(text);

create function public.public_club(p_slug text)
returns table (
  name text,
  open_registration boolean,
  logo_url text,
  brand_color text,
  contact_email text,
  contact_phone text,
  address text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, c.open_registration, c.logo_url, c.brand_color,
         c.contact_email, c.contact_phone, c.address
  from public.club c
  where c.slug = p_slug;
$$;

create function public.public_club_courts(p_slug text)
returns table (name text, surface public.court_surface, covered boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select co.name, co.surface, co.covered
  from public.court co
  join public.club c on c.id = co.club_id
  where c.slug = p_slug and co.active
  order by co.name;
$$;

create function public.public_club_coaches(p_slug text)
returns table (full_name text, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, m.title
  from public.membership m
  join public.person p on p.id = m.person_id
  join public.club c on c.id = m.club_id
  where c.slug = p_slug and m.active and 'coach' = any (m.roles)
  order by p.full_name;
$$;

create function public.public_club_rates(p_slug text)
returns table (name text, category public.rate_category, price_amount integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.name, r.category, r.price_amount
  from public.rate r
  join public.club c on c.id = r.club_id
  where c.slug = p_slug and r.active
  order by r.price_amount;
$$;

revoke all on function
  public.public_club(text),
  public.public_club_courts(text),
  public.public_club_coaches(text),
  public.public_club_rates(text)
  from public, anon, authenticated;

grant execute on function
  public.public_club(text),
  public.public_club_courts(text),
  public.public_club_coaches(text),
  public.public_club_rates(text)
  to anon, authenticated;
