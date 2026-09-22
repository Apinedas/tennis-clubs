-- Row Level Security.
--
-- Helper functions query the tables (source of truth), not the JWT claims:
-- a role change or a deactivation applies immediately. They live in the
-- `internal` schema, which Supabase's API layer never exposes.

create schema if not exists internal;
grant usage on schema internal to authenticated;

create function internal.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admin where person_id = auth.uid()
  );
$$;

create function internal.is_member(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membership
    where person_id = auth.uid() and club_id = p_club and active
  );
$$;

create function internal.has_role(p_club uuid, p_role public.club_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membership
    where person_id = auth.uid()
      and club_id = p_club
      and active
      and p_role = any (roles)
  );
$$;

-- Am I an admin of some club that p_person also belongs to?
create function internal.manages(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membership me
    join public.membership other on other.club_id = me.club_id
    where me.person_id = auth.uid()
      and me.active
      and 'admin' = any (me.roles)
      and other.person_id = p_person
  );
$$;

create function internal.module_enabled(p_club uuid, p_module public.club_module_name)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select active from public.club_module
     where club_id = p_club and module = p_module),
    false
  );
$$;

revoke all on all functions in schema internal from public;
grant execute on all functions in schema internal to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges: nothing for anon; the rest is filtered by policies.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on public.person, public.platform_admin, public.booking to authenticated;
grant select, insert, update, delete on
  public.club, public.membership, public.invitation,
  public.court, public.rate, public.club_module
  to authenticated;
grant insert on public.booking to authenticated;
-- a person's role and club are never editable by themselves
grant update (full_name, phone, active_club_id) on public.person to authenticated;

alter table public.club enable row level security;
alter table public.person enable row level security;
alter table public.membership enable row level security;
alter table public.platform_admin enable row level security;
alter table public.invitation enable row level security;
alter table public.court enable row level security;
alter table public.rate enable row level security;
alter table public.club_module enable row level security;
alter table public.booking enable row level security;

-- ---------------------------------------------------------------------------
-- club
-- ---------------------------------------------------------------------------

create policy club_select on public.club for select to authenticated
  using (internal.is_member(id) or internal.is_platform_admin());

create policy club_insert on public.club for insert to authenticated
  with check (internal.is_platform_admin());

create policy club_update on public.club for update to authenticated
  using (internal.has_role(id, 'admin') or internal.is_platform_admin())
  with check (internal.has_role(id, 'admin') or internal.is_platform_admin());

create policy club_delete on public.club for delete to authenticated
  using (internal.is_platform_admin());

-- ---------------------------------------------------------------------------
-- person (created by trigger on sign-up; no insert or delete)
-- ---------------------------------------------------------------------------

create policy person_select on public.person for select to authenticated
  using (
    id = (select auth.uid())
    or internal.is_platform_admin()
    or internal.manages(id)
  );

create policy person_update on public.person for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- membership
-- ---------------------------------------------------------------------------

create policy membership_select on public.membership for select to authenticated
  using (
    person_id = (select auth.uid())
    or internal.has_role(club_id, 'admin')
    or internal.is_platform_admin()
  );

create policy membership_insert on public.membership for insert to authenticated
  with check (internal.has_role(club_id, 'admin') or internal.is_platform_admin());

create policy membership_update on public.membership for update to authenticated
  using (internal.has_role(club_id, 'admin') or internal.is_platform_admin())
  with check (internal.has_role(club_id, 'admin') or internal.is_platform_admin());

create policy membership_delete on public.membership for delete to authenticated
  using (internal.has_role(club_id, 'admin') or internal.is_platform_admin());

-- ---------------------------------------------------------------------------
-- platform_admin: read-only for the admin themselves; managed via SQL
-- ---------------------------------------------------------------------------

create policy platform_admin_select on public.platform_admin for select to authenticated
  using (person_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- invitation (the token is accepted via public.accept_invitation, not SELECT)
-- ---------------------------------------------------------------------------

create policy invitation_select on public.invitation for select to authenticated
  using (internal.has_role(club_id, 'admin') or internal.is_platform_admin());

create policy invitation_insert on public.invitation for insert to authenticated
  with check (
    (internal.has_role(club_id, 'admin') or internal.is_platform_admin())
    and invited_by = (select auth.uid())
    and used_at is null
  );

create policy invitation_delete on public.invitation for delete to authenticated
  using (internal.has_role(club_id, 'admin') or internal.is_platform_admin());

-- ---------------------------------------------------------------------------
-- court and rate
-- ---------------------------------------------------------------------------

create policy court_select on public.court for select to authenticated
  using (internal.is_member(club_id) or internal.is_platform_admin());

create policy court_write on public.court for all to authenticated
  using (internal.has_role(club_id, 'admin') or internal.is_platform_admin())
  with check (internal.has_role(club_id, 'admin') or internal.is_platform_admin());

create policy rate_select on public.rate for select to authenticated
  using (internal.is_member(club_id) or internal.is_platform_admin());

create policy rate_write on public.rate for all to authenticated
  using (internal.has_role(club_id, 'admin') or internal.is_platform_admin())
  with check (internal.has_role(club_id, 'admin') or internal.is_platform_admin());

-- ---------------------------------------------------------------------------
-- club_module: rows are created by the club trigger; only updated. The club
-- admin manages the normal modules; beta ones are the platform's call.
-- ---------------------------------------------------------------------------

create policy club_module_select on public.club_module for select to authenticated
  using (internal.is_member(club_id) or internal.is_platform_admin());

create policy club_module_update on public.club_module for update to authenticated
  using (
    internal.is_platform_admin()
    or (internal.has_role(club_id, 'admin') and not platform_only)
  )
  with check (
    internal.is_platform_admin()
    or (internal.has_role(club_id, 'admin') and not platform_only)
  );

-- ---------------------------------------------------------------------------
-- booking
--   - student: sees and creates only their own (general availability will
--     go through a separate function so as not to expose other students' names)
--   - coach: sees their own and creates their own lessons
--   - admin: the whole club
--   - no direct update or delete: cancel via public.cancel_booking
-- ---------------------------------------------------------------------------

create policy booking_select on public.booking for select to authenticated
  using (
    internal.is_platform_admin()
    or internal.has_role(club_id, 'admin')
    or (
      internal.is_member(club_id)
      and (
        person_id = (select auth.uid())
        or coach_id = (select auth.uid())
      )
    )
  );

create policy booking_insert on public.booking for insert to authenticated
  with check (
    internal.is_platform_admin()
    or internal.has_role(club_id, 'admin')
    or (
      created_by = (select auth.uid())
      and status = 'confirmed'
      and internal.module_enabled(club_id, 'bookings')
      and (
        (
          person_id = (select auth.uid())
          and coach_id is null
          and internal.has_role(club_id, 'student')
        )
        or (
          coach_id = (select auth.uid())
          and type = 'lesson'
          and internal.has_role(club_id, 'coach')
        )
      )
    )
  );
