-- Comprobantes de pago para Cursos y Torneos, mismo lenguaje que Pagos: un
-- solo paso — el alumno sube el comprobante al pedir el cupo, y la revisión
-- del admin aprueba o rechaza inscripción y pago juntos.
--
-- Torneos no tenía ningún gate de aprobación (una inscripción propia se
-- insertaba de una vez); ahora toda inscripción propia queda 'pending',
-- tenga el torneo tarifa o no — igual que Cursos hoy. El comprobante solo
-- es obligatorio si el torneo tiene una tarifa con precio > 0.

create type public.entry_status as enum ('pending', 'active', 'cancelled');

-- ---------------------------------------------------------------------------
-- tournament gains a rate, same pattern as course.rate_id — null = gratis.
-- ---------------------------------------------------------------------------

alter table public.tournament add column rate_id uuid;
alter table public.tournament add constraint tournament_rate_fk
  foreign key (rate_id, club_id) references public.rate (id, club_id);

-- ---------------------------------------------------------------------------
-- tournament_entry gains the review gate course_enrollment already had,
-- plus the payment proof. Existing rows (registered before this migration)
-- default to 'active' — they were already real, approved entries.
-- ---------------------------------------------------------------------------

alter table public.tournament_entry
  add column status public.entry_status not null default 'active',
  add column payment_proof_path text,
  add column payment_rejection_note text,
  add column reviewed_by uuid references public.person (id) on delete set null,
  add column reviewed_at timestamptz;

alter table public.course_enrollment add column payment_proof_path text;

-- ---------------------------------------------------------------------------
-- create_tournament gains an optional rate. Param list changes, so this is
-- drop + recreate, not create or replace (which would overload instead of
-- replacing).
-- ---------------------------------------------------------------------------

drop function public.create_tournament(uuid, text, text, public.tournament_format, integer, integer, date);

create function public.create_tournament(
  p_club uuid,
  p_name text,
  p_category text,
  p_format public.tournament_format,
  p_group_size integer,
  p_advance_per_group integer,
  p_start_date date,
  p_rate_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (internal.has_role(p_club, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot create tournaments for this club' using errcode = '42501';
  end if;

  insert into public.tournament
    (club_id, name, category, format, group_size, advance_per_group, start_date, rate_id)
  values (p_club, p_name, p_category, p_format, p_group_size, p_advance_per_group, p_start_date, p_rate_id)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- request_enrollment: now takes the payment proof path. A path is only
-- required when the course has a priced rate; the path itself is checked
-- against the caller's own uid so a student can't point an enrollment at
-- someone else's uploaded file.
-- ---------------------------------------------------------------------------

drop function public.request_enrollment(uuid);

create function public.request_enrollment(p_course_id uuid, p_payment_proof_path text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course public.course%rowtype;
  v_price integer;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_course from public.course where id = p_course_id for update;
  if not found then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  if not v_course.active then
    raise exception 'This course is not open for enrollment' using errcode = '22023';
  end if;
  if not (
    internal.has_role(v_course.club_id, 'student')
    and internal.module_enabled(v_course.club_id, 'courses')
  ) then
    raise exception 'You cannot enroll in this course' using errcode = '42501';
  end if;

  if v_course.rate_id is not null then
    select price_amount into v_price from public.rate where id = v_course.rate_id;
  end if;
  if coalesce(v_price, 0) > 0 and p_payment_proof_path is null then
    raise exception 'This course requires a payment proof' using errcode = '22023';
  end if;
  if p_payment_proof_path is not null
     and p_payment_proof_path !~ ('^' || v_course.club_id::text || '/' || v_uid::text || '/') then
    raise exception 'Invalid payment proof path' using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.course_enrollment
  where course_id = p_course_id and status in ('pending', 'active', 'pending_cancellation');
  if v_count >= v_course.capacity then
    raise exception 'This course is full' using errcode = '23514';
  end if;

  insert into public.course_enrollment (course_id, club_id, person_id, status, requested_by, payment_proof_path)
  values (p_course_id, v_course.club_id, v_uid, 'pending', v_uid, p_payment_proof_path)
  on conflict (course_id, person_id) do update
    set status = 'pending', requested_by = v_uid, review_note = null, reviewed_by = null,
        reviewed_at = null, payment_proof_path = p_payment_proof_path
    where public.course_enrollment.status = 'cancelled';

  if not found then
    raise exception 'You already have an enrollment for this course' using errcode = '23505';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- request_tournament_entry: used to insert active immediately; now always
-- inserts pending (admin reviews every self-request, same as Cursos), and
-- takes the same conditionally-required payment proof as above.
-- register_entry (admin adding someone directly) is unchanged — the new
-- columns default to 'active' / null, so an admin-added entry still skips
-- review entirely, same as enroll_member already does for Cursos.
-- ---------------------------------------------------------------------------

drop function public.request_tournament_entry(uuid);

create function public.request_tournament_entry(p_tournament_id uuid, p_payment_proof_path text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournament%rowtype;
  v_price integer;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_tournament from public.tournament where id = p_tournament_id;
  if not found then
    raise exception 'Tournament not found' using errcode = 'P0002';
  end if;
  if not v_tournament.registration_open or not v_tournament.active then
    raise exception 'Registration is closed for this tournament' using errcode = '22023';
  end if;
  if not (
    internal.has_role(v_tournament.club_id, 'student')
    and internal.module_enabled(v_tournament.club_id, 'tournaments')
  ) then
    raise exception 'You cannot register for this tournament' using errcode = '42501';
  end if;

  if v_tournament.rate_id is not null then
    select price_amount into v_price from public.rate where id = v_tournament.rate_id;
  end if;
  if coalesce(v_price, 0) > 0 and p_payment_proof_path is null then
    raise exception 'This tournament requires a payment proof' using errcode = '22023';
  end if;
  if p_payment_proof_path is not null
     and p_payment_proof_path !~ ('^' || v_tournament.club_id::text || '/' || v_uid::text || '/') then
    raise exception 'Invalid payment proof path' using errcode = '22023';
  end if;

  insert into public.tournament_entry (tournament_id, club_id, person_id, status, payment_proof_path)
  values (p_tournament_id, v_tournament.club_id, v_uid, 'pending', p_payment_proof_path)
  on conflict (tournament_id, person_id) do update
    set status = 'pending', payment_proof_path = p_payment_proof_path,
        payment_rejection_note = null, reviewed_by = null, reviewed_at = null
    where public.tournament_entry.status = 'cancelled';

  if not found then
    raise exception 'You already have an entry for this tournament' using errcode = '23505';
  end if;
end;
$$;

create function public.review_entry(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_entry public.tournament_entry%rowtype;
begin
  select * into v_entry from public.tournament_entry where id = p_id for update;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_entry.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot review entries for this club' using errcode = '42501';
  end if;
  if v_entry.status <> 'pending' then
    raise exception 'This entry has nothing pending review' using errcode = '22023';
  end if;

  update public.tournament_entry
  set status = case when p_approve then 'active' else 'cancelled' end,
      payment_rejection_note = p_note,
      reviewed_by = v_uid,
      reviewed_at = now()
  where id = p_id;
end;
$$;

revoke all on function
  public.create_tournament(uuid, text, text, public.tournament_format, integer, integer, date, uuid),
  public.request_enrollment(uuid, text),
  public.request_tournament_entry(uuid, text),
  public.review_entry(uuid, boolean, text)
  from public, anon, authenticated;

grant execute on function
  public.create_tournament(uuid, text, text, public.tournament_format, integer, integer, date, uuid),
  public.request_enrollment(uuid, text),
  public.request_tournament_entry(uuid, text),
  public.review_entry(uuid, boolean, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Read shapes that change: the two club-wide lists gain pricing, the entry
-- and pending-review lists gain status/proof. Bracket generation only ever
-- sees entries that cleared review.
-- ---------------------------------------------------------------------------

drop function public.list_club_tournaments(uuid);

create function public.list_club_tournaments(p_club uuid)
returns table (
  id uuid,
  name text,
  category text,
  format public.tournament_format,
  group_size integer,
  advance_per_group integer,
  registration_open boolean,
  bracket_generated boolean,
  knockout_generated boolean,
  start_date date,
  active boolean,
  entry_count bigint,
  rate_id uuid,
  price_amount integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id, t.name, t.category, t.format, t.group_size, t.advance_per_group,
    t.registration_open, t.bracket_generated, t.knockout_generated, t.start_date, t.active,
    (select count(*) from public.tournament_entry te
     where te.tournament_id = t.id and te.status <> 'cancelled'),
    t.rate_id, r.price_amount
  from public.tournament t
  left join public.rate r on r.id = t.rate_id
  where t.club_id = p_club and internal.is_member(p_club)
  order by t.created_at desc;
$$;

drop function public.list_tournament_entries(uuid);

create function public.list_tournament_entries(p_tournament_id uuid)
returns table (
  id uuid,
  person_id uuid,
  full_name text,
  seed integer,
  group_label text,
  status public.entry_status,
  payment_proof_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select te.id, te.person_id, p.full_name, te.seed, te.group_label, te.status, te.payment_proof_path
  from public.tournament_entry te
  join public.person p on p.id = te.person_id
  join public.tournament t on t.id = te.tournament_id
  where te.tournament_id = p_tournament_id and internal.is_member(t.club_id)
  order by coalesce(te.seed, 999999), p.full_name;
$$;

create function public.list_pending_tournament_entries(p_club uuid)
returns table (
  id uuid,
  tournament_id uuid,
  tournament_name text,
  person_id uuid,
  person_name text,
  payment_proof_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select te.id, te.tournament_id, t.name, te.person_id, p.full_name, te.payment_proof_path
  from public.tournament_entry te
  join public.tournament t on t.id = te.tournament_id
  join public.person p on p.id = te.person_id
  where te.club_id = p_club
    and te.status = 'pending'
    and (internal.has_role(p_club, 'admin') or internal.is_platform_admin())
  order by te.created_at;
$$;

drop function public.list_pending_enrollments(uuid);

create function public.list_pending_enrollments(p_club uuid)
returns table (
  id uuid,
  course_id uuid,
  course_name text,
  person_id uuid,
  person_name text,
  status public.enrollment_status,
  payment_proof_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select ce.id, ce.course_id, c.name, ce.person_id, p.full_name, ce.status, ce.payment_proof_path
  from public.course_enrollment ce
  join public.course c on c.id = ce.course_id
  join public.person p on p.id = ce.person_id
  where ce.club_id = p_club
    and ce.status in ('pending', 'pending_cancellation')
    and (internal.has_role(p_club, 'admin') or internal.is_platform_admin())
  order by ce.created_at;
$$;

revoke all on function
  public.list_club_tournaments(uuid),
  public.list_tournament_entries(uuid),
  public.list_pending_tournament_entries(uuid),
  public.list_pending_enrollments(uuid)
  from public, anon, authenticated;

grant execute on function
  public.list_club_tournaments(uuid),
  public.list_tournament_entries(uuid),
  public.list_pending_tournament_entries(uuid),
  public.list_pending_enrollments(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: same private "payment-proofs" bucket Pagos already uses, with a
-- second path convention keyed by the uploader (not by a booking id) since
-- the enrollment/entry row doesn't exist yet at upload time:
--   {club_id}/{person_id}/<anything>/<file>
-- Ownership is just "the path's person segment is me" — no join needed, so
-- one policy set covers both Cursos and Torneos. It coexists with the
-- existing booking-keyed policies (foldername[2] there is a booking id, not
-- a person id, so the two never collide).
-- ---------------------------------------------------------------------------

create policy member_proofs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] is not null
    and ((storage.foldername(name))[2])::uuid = auth.uid()
  );

create policy member_proofs_read on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      ((storage.foldername(name))[2])::uuid = auth.uid()
      or internal.has_role(((storage.foldername(name))[1])::uuid, 'admin')
      or internal.is_platform_admin()
    )
  );

create policy member_proofs_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[2])::uuid = auth.uid()
  );
