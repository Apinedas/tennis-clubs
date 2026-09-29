-- Cursos: clases grupales recurrentes con cupo, sin lista de espera.
--
-- Cada sesión del curso es una fila de public.booking (type = 'course') —
-- así se reutiliza tal cual el exclusion constraint que ya impide choques
-- de cancha/entrenador, en vez de inventar una segunda forma de bloquear
-- horarios. Inscripción y baja siguen el mismo patrón que Pagos: la acción
-- del alumno queda 'pending' hasta que el admin la revisa; el admin puede
-- también inscribir/retirar directamente sin pasar por revisión.

create type public.enrollment_status as enum ('pending', 'active', 'pending_cancellation', 'cancelled');

-- Backfill: los clubes ya existentes no reciben automáticamente la fila
-- del módulo nuevo (el trigger que lo hace solo corre al crear un club).
insert into public.club_module (club_id, module, active)
select id, 'courses', false from public.club
on conflict (club_id, module) do nothing;

-- ---------------------------------------------------------------------------
-- course
-- ---------------------------------------------------------------------------

create table public.course (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  court_id uuid not null,
  head_coach_id uuid not null,
  assistant_coach_id uuid,
  name text not null,
  level text,
  start_date date not null,
  end_date date not null,
  weekdays smallint[] not null,
  start_time time not null,
  end_time time not null,
  capacity integer not null check (capacity > 0),
  rate_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),

  unique (id, club_id),
  constraint course_court_fk foreign key (court_id, club_id)
    references public.court (id, club_id),
  constraint course_head_coach_fk foreign key (head_coach_id, club_id)
    references public.membership (person_id, club_id),
  constraint course_assistant_coach_fk foreign key (assistant_coach_id, club_id)
    references public.membership (person_id, club_id),
  constraint course_rate_fk foreign key (rate_id, club_id)
    references public.rate (id, club_id),

  check (end_date >= start_date),
  check (end_time > start_time),
  check (assistant_coach_id is null or assistant_coach_id <> head_coach_id),
  check (cardinality(weekdays) >= 1 and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
);

create index course_club_idx on public.course (club_id);

-- ---------------------------------------------------------------------------
-- course_enrollment
-- ---------------------------------------------------------------------------

create table public.course_enrollment (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  club_id uuid not null references public.club (id) on delete cascade,
  person_id uuid not null,
  status public.enrollment_status not null default 'pending',
  requested_by uuid references public.person (id) on delete set null,
  reviewed_by uuid references public.person (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),

  unique (course_id, person_id),
  constraint course_enrollment_course_fk foreign key (course_id, club_id)
    references public.course (id, club_id),
  constraint course_enrollment_person_fk foreign key (person_id, club_id)
    references public.membership (person_id, club_id)
);

create index course_enrollment_course_idx on public.course_enrollment (course_id);
create index course_enrollment_person_idx on public.course_enrollment (person_id);

-- ---------------------------------------------------------------------------
-- course_attendance — one row per enrolled student and session, created on
-- demand when a coach marks it (never pre-populated for every combination).
-- ---------------------------------------------------------------------------

create table public.course_attendance (
  id uuid primary key default gen_random_uuid(),
  session_booking_id uuid not null references public.booking (id) on delete cascade,
  course_id uuid not null,
  club_id uuid not null references public.club (id) on delete cascade,
  person_id uuid not null,
  present boolean not null default false,
  marked_by uuid references public.person (id) on delete set null,
  marked_at timestamptz,

  unique (session_booking_id, person_id),
  constraint course_attendance_course_fk foreign key (course_id, club_id)
    references public.course (id, club_id),
  constraint course_attendance_person_fk foreign key (person_id, club_id)
    references public.membership (person_id, club_id)
);

-- ---------------------------------------------------------------------------
-- booking gains a link to the course whose session it is. The two checks
-- that required a person/guest and a type for every non-blocked booking
-- need to also allow "it's a group course session" as a third case.
-- ---------------------------------------------------------------------------

alter table public.booking add column course_id uuid;
alter table public.booking add constraint booking_course_fk
  foreign key (course_id, club_id) references public.course (id, club_id);

alter table public.booking drop constraint booking_check2;
alter table public.booking add constraint booking_check2
  check (status = 'blocked' or type = 'course' or person_id is not null or guest_name is not null);

-- ---------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------

grant select on public.course, public.course_enrollment, public.course_attendance to authenticated;
-- Only the scheduling fields are immutable after create_course() generates
-- sessions from them; the rest is a normal admin-editable row, same shape
-- as court/rate. Creation, enrollment and attendance all go through RPCs
-- below — no INSERT grant on any of these three tables.
grant update (name, level, head_coach_id, assistant_coach_id, capacity, rate_id, active)
  on public.course to authenticated;

alter table public.course enable row level security;
alter table public.course_enrollment enable row level security;
alter table public.course_attendance enable row level security;

create policy course_select on public.course for select to authenticated
  using (internal.is_member(club_id) or internal.is_platform_admin());

create policy course_update on public.course for update to authenticated
  using (internal.has_role(club_id, 'admin') or internal.is_platform_admin())
  with check (internal.has_role(club_id, 'admin') or internal.is_platform_admin());

create policy course_enrollment_select on public.course_enrollment for select to authenticated
  using (
    internal.is_platform_admin()
    or internal.has_role(club_id, 'admin')
    or person_id = (select auth.uid())
    or exists (
      select 1 from public.course c
      where c.id = course_enrollment.course_id
        and (c.head_coach_id = (select auth.uid()) or c.assistant_coach_id = (select auth.uid()))
    )
  );

create policy course_attendance_select on public.course_attendance for select to authenticated
  using (
    internal.is_platform_admin()
    or internal.has_role(club_id, 'admin')
    or person_id = (select auth.uid())
    or exists (
      select 1 from public.course c
      where c.id = course_attendance.course_id
        and (c.head_coach_id = (select auth.uid()) or c.assistant_coach_id = (select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- create_course: inserts the course, then one booking per session in the
-- same transaction. Any date that collides with an existing booking/block/
-- other course rolls the whole thing back (booking_no_overlap_court /
-- booking_no_overlap_coach are the same constraints regular reservations
-- already rely on) — no partial course, no silently-skipped dates.
-- ---------------------------------------------------------------------------

create function public.create_course(
  p_club uuid,
  p_court_id uuid,
  p_head_coach_id uuid,
  p_assistant_coach_id uuid,
  p_name text,
  p_level text,
  p_start_date date,
  p_end_date date,
  p_weekdays smallint[],
  p_start_time time,
  p_end_time time,
  p_capacity integer,
  p_rate_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
  v_timezone text;
  v_day timestamp;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  if not (internal.has_role(p_club, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot create courses for this club' using errcode = '42501';
  end if;

  select timezone into v_timezone from public.club where id = p_club;
  if v_timezone is null then
    raise exception 'Club not found' using errcode = 'P0002';
  end if;

  insert into public.course (
    club_id, court_id, head_coach_id, assistant_coach_id, name, level,
    start_date, end_date, weekdays, start_time, end_time, capacity, rate_id
  ) values (
    p_club, p_court_id, p_head_coach_id, p_assistant_coach_id, p_name, p_level,
    p_start_date, p_end_date, p_weekdays, p_start_time, p_end_time, p_capacity, p_rate_id
  )
  returning id into v_course_id;

  for v_day in
    select d from generate_series(p_start_date::timestamp, p_end_date::timestamp, interval '1 day') as d
    where extract(isodow from d)::smallint = any (p_weekdays)
  loop
    v_starts_at := (v_day + p_start_time) at time zone v_timezone;
    v_ends_at := (v_day + p_end_time) at time zone v_timezone;

    begin
      insert into public.booking (
        club_id, court_id, coach_id, type, status, starts_at, ends_at, course_id
      ) values (
        p_club, p_court_id, p_head_coach_id, 'course', 'confirmed', v_starts_at, v_ends_at, v_course_id
      );
    exception when exclusion_violation then
      raise exception 'La cancha ya está ocupada el %', to_char(v_day, 'DD/MM/YYYY') using errcode = '23P01';
    end;
  end loop;

  return v_course_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enrollment lifecycle
-- ---------------------------------------------------------------------------

create function public.request_enrollment(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course public.course%rowtype;
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

  select count(*) into v_count
  from public.course_enrollment
  where course_id = p_course_id and status in ('pending', 'active', 'pending_cancellation');
  if v_count >= v_course.capacity then
    raise exception 'This course is full' using errcode = '23514';
  end if;

  insert into public.course_enrollment (course_id, club_id, person_id, status, requested_by)
  values (p_course_id, v_course.club_id, v_uid, 'pending', v_uid)
  on conflict (course_id, person_id) do update
    set status = 'pending', requested_by = v_uid, review_note = null, reviewed_by = null, reviewed_at = null
    where public.course_enrollment.status = 'cancelled';

  if not found then
    raise exception 'You already have an enrollment for this course' using errcode = '23505';
  end if;
end;
$$;

create function public.enroll_member(p_course_id uuid, p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course public.course%rowtype;
  v_count integer;
begin
  select * into v_course from public.course where id = p_course_id for update;
  if not found then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_course.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot manage enrollments for this course' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.course_enrollment
  where course_id = p_course_id and status in ('pending', 'active', 'pending_cancellation');
  if v_count >= v_course.capacity then
    raise exception 'This course is full' using errcode = '23514';
  end if;

  insert into public.course_enrollment (course_id, club_id, person_id, status, requested_by, reviewed_by, reviewed_at)
  values (p_course_id, v_course.club_id, p_person_id, 'active', v_uid, v_uid, now())
  on conflict (course_id, person_id) do update
    set status = 'active', reviewed_by = v_uid, reviewed_at = now(), review_note = null
    where public.course_enrollment.status = 'cancelled';

  if not found then
    raise exception 'This person already has an enrollment for this course' using errcode = '23505';
  end if;
end;
$$;

create function public.request_unenroll(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_enrollment public.course_enrollment%rowtype;
begin
  select * into v_enrollment from public.course_enrollment where id = p_id for update;
  if not found then
    raise exception 'Enrollment not found' using errcode = 'P0002';
  end if;
  if v_enrollment.person_id <> v_uid then
    raise exception 'You cannot cancel this enrollment' using errcode = '42501';
  end if;
  if v_enrollment.status <> 'active' then
    raise exception 'This enrollment is not active' using errcode = '22023';
  end if;

  update public.course_enrollment set status = 'pending_cancellation' where id = p_id;
end;
$$;

create function public.review_enrollment(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_enrollment public.course_enrollment%rowtype;
  v_new_status public.enrollment_status;
begin
  select * into v_enrollment from public.course_enrollment where id = p_id for update;
  if not found then
    raise exception 'Enrollment not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_enrollment.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot review enrollments for this club' using errcode = '42501';
  end if;

  if v_enrollment.status = 'pending' then
    v_new_status := case when p_approve then 'active' else 'cancelled' end;
  elsif v_enrollment.status = 'pending_cancellation' then
    v_new_status := case when p_approve then 'cancelled' else 'active' end;
  else
    raise exception 'This enrollment has nothing pending review' using errcode = '22023';
  end if;

  update public.course_enrollment
  set status = v_new_status, review_note = p_note, reviewed_by = v_uid, reviewed_at = now()
  where id = p_id;
end;
$$;

create function public.remove_enrollment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_enrollment public.course_enrollment%rowtype;
begin
  select * into v_enrollment from public.course_enrollment where id = p_id for update;
  if not found then
    raise exception 'Enrollment not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_enrollment.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot manage enrollments for this club' using errcode = '42501';
  end if;

  update public.course_enrollment
  set status = 'cancelled', reviewed_by = v_uid, reviewed_at = now()
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------

create function public.mark_attendance(p_session_booking_id uuid, p_person_id uuid, p_present boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.booking%rowtype;
begin
  select * into v_booking from public.booking where id = p_session_booking_id;
  if not found or v_booking.course_id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not (
    internal.has_role(v_booking.club_id, 'admin')
    or internal.is_platform_admin()
    or exists (
      select 1 from public.course c
      where c.id = v_booking.course_id
        and (c.head_coach_id = v_uid or c.assistant_coach_id = v_uid)
    )
  ) then
    raise exception 'You cannot mark attendance for this session' using errcode = '42501';
  end if;

  insert into public.course_attendance
    (session_booking_id, course_id, club_id, person_id, present, marked_by, marked_at)
  values
    (p_session_booking_id, v_booking.course_id, v_booking.club_id, p_person_id, p_present, v_uid, now())
  on conflict (session_booking_id, person_id) do update
    set present = p_present, marked_by = v_uid, marked_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Read-side RPCs (same "empty instead of erroring" pattern as
-- list_club_members / list_pending_payments)
-- ---------------------------------------------------------------------------

create function public.list_club_courses(p_club uuid)
returns table (
  id uuid,
  name text,
  level text,
  court_name text,
  head_coach_name text,
  start_date date,
  end_date date,
  weekdays smallint[],
  start_time time,
  end_time time,
  capacity integer,
  enrolled_count bigint,
  price_amount integer,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.name, c.level, co.name, p.full_name,
    c.start_date, c.end_date, c.weekdays, c.start_time, c.end_time,
    c.capacity,
    (select count(*) from public.course_enrollment ce
     where ce.course_id = c.id and ce.status in ('pending', 'active', 'pending_cancellation')),
    r.price_amount,
    c.active
  from public.course c
  join public.court co on co.id = c.court_id
  join public.person p on p.id = c.head_coach_id
  left join public.rate r on r.id = c.rate_id
  where c.club_id = p_club and internal.is_member(p_club)
  order by c.start_date desc;
$$;

create function public.list_pending_enrollments(p_club uuid)
returns table (
  id uuid,
  course_id uuid,
  course_name text,
  person_id uuid,
  person_name text,
  status public.enrollment_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select ce.id, ce.course_id, c.name, ce.person_id, p.full_name, ce.status
  from public.course_enrollment ce
  join public.course c on c.id = ce.course_id
  join public.person p on p.id = ce.person_id
  where ce.club_id = p_club
    and ce.status in ('pending', 'pending_cancellation')
    and (internal.has_role(p_club, 'admin') or internal.is_platform_admin())
  order by ce.created_at;
$$;

create function public.list_course_roster(p_course_id uuid)
returns table (
  enrollment_id uuid,
  person_id uuid,
  full_name text,
  status public.enrollment_status,
  review_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select ce.id, ce.person_id, p.full_name, ce.status, ce.review_note
  from public.course_enrollment ce
  join public.person p on p.id = ce.person_id
  join public.course c on c.id = ce.course_id
  where ce.course_id = p_course_id
    and (
      internal.has_role(c.club_id, 'admin')
      or internal.is_platform_admin()
      or c.head_coach_id = auth.uid()
      or c.assistant_coach_id = auth.uid()
    )
  order by p.full_name;
$$;

revoke all on function
  public.create_course(uuid, uuid, uuid, uuid, text, text, date, date, smallint[], time, time, integer, uuid),
  public.request_enrollment(uuid),
  public.enroll_member(uuid, uuid),
  public.request_unenroll(uuid),
  public.review_enrollment(uuid, boolean, text),
  public.remove_enrollment(uuid),
  public.mark_attendance(uuid, uuid, boolean),
  public.list_club_courses(uuid),
  public.list_pending_enrollments(uuid),
  public.list_course_roster(uuid)
  from public, anon, authenticated;

grant execute on function
  public.create_course(uuid, uuid, uuid, uuid, text, text, date, date, smallint[], time, time, integer, uuid),
  public.request_enrollment(uuid),
  public.enroll_member(uuid, uuid),
  public.request_unenroll(uuid),
  public.review_enrollment(uuid, boolean, text),
  public.remove_enrollment(uuid),
  public.mark_attendance(uuid, uuid, boolean),
  public.list_club_courses(uuid),
  public.list_pending_enrollments(uuid),
  public.list_course_roster(uuid)
  to authenticated;
