-- mark_attendance checked that the caller could manage the session, but
-- never checked that p_person_id was actually enrolled — a coach could
-- record attendance for anyone, enrolled or not.

create or replace function public.mark_attendance(p_session_booking_id uuid, p_person_id uuid, p_present boolean)
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

  if not exists (
    select 1 from public.course_enrollment ce
    where ce.course_id = v_booking.course_id and ce.person_id = p_person_id and ce.status = 'active'
  ) then
    raise exception 'This person is not actively enrolled in this course' using errcode = '22023';
  end if;

  insert into public.course_attendance
    (session_booking_id, course_id, club_id, person_id, present, marked_by, marked_at)
  values
    (p_session_booking_id, v_booking.course_id, v_booking.club_id, p_person_id, p_present, v_uid, now())
  on conflict (session_booking_id, person_id) do update
    set present = p_present, marked_by = v_uid, marked_at = now();
end;
$$;
