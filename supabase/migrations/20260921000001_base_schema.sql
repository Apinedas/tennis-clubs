-- Multi-club base schema.
--
-- Model: `person` is the account (one per Auth user); `membership` links it
-- to each club with one or more roles. The platform admin lives separately
-- (`platform_admin`) because it doesn't belong to any club.

create extension if not exists btree_gist;

create type public.club_role as enum ('admin', 'coach', 'student');
create type public.booking_type as enum ('singles', 'doubles', 'lesson');
create type public.booking_status as enum ('confirmed', 'cancelled', 'blocked');
create type public.rate_category as enum ('member', 'non_member');
create type public.club_module_name as enum ('bookings', 'lessons', 'dynamic_pricing', 'tournaments');

-- ---------------------------------------------------------------------------
-- Club
-- ---------------------------------------------------------------------------

create table public.club (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  timezone text not null default 'America/Bogota',
  open_registration boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- People and memberships
-- ---------------------------------------------------------------------------

create table public.person (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  active_club_id uuid,
  created_at timestamptz not null default now()
);

create table public.membership (
  person_id uuid not null references public.person (id) on delete cascade,
  club_id uuid not null references public.club (id) on delete cascade,
  roles public.club_role[] not null check (cardinality(roles) >= 1),
  member_number text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (person_id, club_id)
);

create unique index membership_member_number_uidx
  on public.membership (club_id, member_number)
  where member_number is not null;

create index membership_club_idx on public.membership (club_id);

-- The active club must be one the person is a member of. If the membership
-- is deleted, only active_club_id is cleared (not the person).
alter table public.person
  add constraint person_active_club_fk
  foreign key (id, active_club_id)
  references public.membership (person_id, club_id)
  on delete set null (active_club_id);

create table public.platform_admin (
  person_id uuid primary key references public.person (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  email text not null,
  roles public.club_role[] not null check (cardinality(roles) >= 1),
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid references public.person (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.person (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invitation_club_idx on public.invitation (club_id);

-- ---------------------------------------------------------------------------
-- Courts, rates and modules
-- ---------------------------------------------------------------------------

create table public.court (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  name text not null,
  surface text,
  active boolean not null default true,
  unique (id, club_id),
  unique (club_id, name)
);

create table public.rate (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  court_id uuid, -- null = applies to every court in the club
  name text not null,
  category public.rate_category not null,
  start_time time not null,
  end_time time not null,
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}',
  price_cop integer not null check (price_cop >= 0),
  unique (id, club_id),
  constraint rate_court_fk foreign key (court_id, club_id)
    references public.court (id, club_id),
  check (end_time > start_time),
  check (
    cardinality(weekdays) >= 1
    and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  )
);

create index rate_club_idx on public.rate (club_id);

create table public.club_module (
  club_id uuid not null references public.club (id) on delete cascade,
  module public.club_module_name not null,
  active boolean not null default false,
  -- true = only the platform admin can toggle it (beta modules)
  platform_only boolean not null default false,
  primary key (club_id, module)
);

-- Every new club starts with all modules registered; only `bookings` active.
create function public.initialize_club_modules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.club_module (club_id, module, active)
  select new.id, m, m = 'bookings'
  from unnest(enum_range(null::public.club_module_name)) as m;
  return new;
end;
$$;

create trigger club_initialize_modules
  after insert on public.club
  for each row execute function public.initialize_club_modules();

-- Only the platform admin can change `platform_only`.
create function public.protect_platform_only_module()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.platform_only is distinct from old.platform_only
     and auth.uid() is not null
     and not exists (select 1 from public.platform_admin where person_id = auth.uid()) then
    raise exception 'Only the platform admin can change platform_only'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger club_module_protect_platform_only
  before update on public.club_module
  for each row execute function public.protect_platform_only_module();

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

create table public.booking (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  court_id uuid not null,
  person_id uuid,        -- member/student with an account
  guest_name text,        -- walk-in guest without an account (booked at the front desk)
  coach_id uuid,
  type public.booking_type, -- null only for blocks (maintenance, rain)
  status public.booking_status not null default 'confirmed',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,              -- on blocks, the visible label
  created_by uuid default auth.uid() references public.person (id) on delete set null,
  created_at timestamptz not null default now(),

  -- Composite FKs: entities from different clubs can never be mixed.
  constraint booking_court_fk foreign key (court_id, club_id)
    references public.court (id, club_id),
  constraint booking_person_fk foreign key (person_id, club_id)
    references public.membership (person_id, club_id),
  constraint booking_coach_fk foreign key (coach_id, club_id)
    references public.membership (person_id, club_id),

  check (ends_at > starts_at),
  check (person_id is null or coach_id is null or person_id <> coach_id),
  check (status = 'blocked' or person_id is not null or guest_name is not null),
  check (status = 'blocked' or type is not null),

  -- A court can't have two overlapping non-cancelled bookings...
  constraint booking_no_overlap_court exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled'),

  -- ...and a coach can't be in two places at once.
  constraint booking_no_overlap_coach exclude using gist (
    coach_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (coach_id is not null and status <> 'cancelled')
);

create index booking_club_starts_at_idx on public.booking (club_id, starts_at);
create index booking_person_idx on public.booking (person_id);
create index booking_coach_idx on public.booking (coach_id);

-- Validations a FK can't express: coach role, active memberships and an
-- active court. Only checked on insert or when the field changes, so
-- cancelling historical bookings still works after someone was deactivated.
-- security definer: it must see other people's memberships, which RLS hides
-- from whoever inserts (e.g. a coach booking a lesson for a student).
create function public.validate_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.coach_id is not null
     and (tg_op = 'INSERT' or new.coach_id is distinct from old.coach_id)
     and not exists (
       select 1 from public.membership m
       where m.person_id = new.coach_id
         and m.club_id = new.club_id
         and m.active
         and 'coach' = any (m.roles)
     ) then
    raise exception 'The person is not an active coach at this club'
      using errcode = '23514';
  end if;

  if new.person_id is not null
     and (tg_op = 'INSERT' or new.person_id is distinct from old.person_id)
     and not exists (
       select 1 from public.membership m
       where m.person_id = new.person_id
         and m.club_id = new.club_id
         and m.active
     ) then
    raise exception 'The person is not an active member of this club'
      using errcode = '23514';
  end if;

  if new.status = 'confirmed'
     and (tg_op = 'INSERT' or new.court_id is distinct from old.court_id)
     and not exists (
       select 1 from public.court c
       where c.id = new.court_id and c.club_id = new.club_id and c.active
     ) then
    raise exception 'The court does not exist in this club or is not active'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger booking_validate
  before insert or update on public.booking
  for each row execute function public.validate_booking();

-- ---------------------------------------------------------------------------
-- Admin integrity
-- ---------------------------------------------------------------------------

-- A club can never be left without an active admin.
create function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ('admin' = any (old.roles) and old.active) then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and 'admin' = any (new.roles) and new.active then
    return new;
  end if;

  -- Cascading delete of a whole club: allowed.
  if not exists (select 1 from public.club where id = old.club_id) then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from public.membership m
    where m.club_id = old.club_id
      and m.person_id <> old.person_id
      and m.active
      and 'admin' = any (m.roles)
  ) then
    raise exception 'Cannot remove the last active admin of the club'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger membership_protect_last_admin
  before update or delete on public.membership
  for each row execute function public.protect_last_admin();
