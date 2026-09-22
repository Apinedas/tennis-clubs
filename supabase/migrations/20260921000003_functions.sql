-- Functions exposed as RPCs, plus the sign-up trigger.
-- All are security definer with an empty search_path; each explicitly
-- validates who is allowed to call it.

-- ---------------------------------------------------------------------------
-- Sign-up: creates the person and, if sign-up carries an open club, the
-- student membership. Works with email confirmation on (it doesn't depend on
-- having a session). The role is always 'student': admin and coach only join
-- via invitation.
-- ---------------------------------------------------------------------------

create function public.create_person_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_slug text := nullif(new.raw_user_meta_data ->> 'club_slug', '');
begin
  insert into public.person (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    )
  );

  if v_slug is not null then
    select id into v_club_id
    from public.club
    where slug = v_slug and open_registration;

    if v_club_id is not null then
      insert into public.membership (person_id, club_id, roles)
      values (new.id, v_club_id, array['student']::public.club_role[]);

      update public.person set active_club_id = v_club_id where id = new.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger auth_users_create_person
  after insert on auth.users
  for each row execute function public.create_person_from_auth();

-- ---------------------------------------------------------------------------
-- Minimal public data for the sign-up and invitation screens
-- ---------------------------------------------------------------------------

create function public.public_club(p_slug text)
returns table (name text, open_registration boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, c.open_registration from public.club c where c.slug = p_slug;
$$;

create function public.view_invitation(p_token text)
returns table (club_name text, email text, roles public.club_role[])
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, i.email, i.roles
  from public.invitation i
  join public.club c on c.id = i.club_id
  where i.token = p_token
    and i.used_at is null
    and i.expires_at > now();
$$;

-- ---------------------------------------------------------------------------
-- Join a club as a student (person who already has an account)
-- ---------------------------------------------------------------------------

create function public.join_club(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_club public.club%rowtype;
  v_active boolean;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_club from public.club where slug = p_slug;
  if not found then
    raise exception 'Club not found' using errcode = 'P0002';
  end if;

  select active into v_active
  from public.membership
  where person_id = v_uid and club_id = v_club.id;

  if found then
    if not v_active then
      raise exception 'Your membership at this club is deactivated'
        using errcode = '42501';
    end if;
    return v_club.id; -- already a member: their roles are left untouched
  end if;

  if not v_club.open_registration then
    raise exception 'This club does not accept open registration' using errcode = '42501';
  end if;

  insert into public.membership (person_id, club_id, roles)
  values (v_uid, v_club.id, array['student']::public.club_role[]);

  update public.person set active_club_id = v_club.id where id = v_uid;
  return v_club.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accept an invitation (single-use token)
-- ---------------------------------------------------------------------------

create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitation%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_inv
  from public.invitation
  where token = p_token
  for update;

  if not found or v_inv.used_at is not null or v_inv.expires_at <= now() then
    raise exception 'The invitation is invalid or already expired' using errcode = 'P0002';
  end if;

  -- If already a member, roles are merged and the membership is reactivated;
  -- otherwise it's created.
  insert into public.membership (person_id, club_id, roles)
  values (v_uid, v_inv.club_id, v_inv.roles)
  on conflict (person_id, club_id) do update
    set roles = (
          select array_agg(distinct r)
          from unnest(public.membership.roles || excluded.roles) as r
        ),
        active = true;

  update public.invitation
  set used_at = now(), used_by = v_uid
  where id = v_inv.id;

  update public.person set active_club_id = v_inv.club_id where id = v_uid;
  return v_inv.club_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel a booking: its owner, their coach, or a club admin
-- ---------------------------------------------------------------------------

create function public.cancel_booking(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.booking%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_booking from public.booking where id = p_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if not (
    exists (select 1 from public.platform_admin where person_id = v_uid)
    or exists (
      select 1 from public.membership m
      where m.person_id = v_uid and m.club_id = v_booking.club_id and m.active
        and (
          'admin' = any (m.roles)
          or v_uid = v_booking.person_id
          or v_uid = v_booking.coach_id
        )
    )
  ) then
    raise exception 'You cannot cancel this booking' using errcode = '42501';
  end if;

  update public.booking set status = 'cancelled' where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute permissions
-- ---------------------------------------------------------------------------

revoke all on function
  public.public_club(text),
  public.view_invitation(text),
  public.join_club(text),
  public.accept_invitation(text),
  public.cancel_booking(uuid)
  from public, anon, authenticated;

grant execute on function public.public_club(text), public.view_invitation(text)
  to anon, authenticated;
grant execute on function
  public.join_club(text),
  public.accept_invitation(text),
  public.cancel_booking(uuid)
  to authenticated;
