-- Lesson requests: a student can now ask a specific coach for a lesson,
-- which lands as 'pending' until the coach accepts it. Rejecting reuses
-- cancel_booking() unchanged (a coach can already cancel any booking where
-- they're coach_id, in any status). Accepting needs a new transition
-- (pending -> confirmed) that cancel_booking doesn't do.

drop policy booking_insert on public.booking;

create policy booking_insert on public.booking for insert to authenticated
  with check (
    internal.is_platform_admin()
    or internal.has_role(club_id, 'admin')
    or (
      created_by = (select auth.uid())
      and (
        (
          -- A member booking a court themselves (general reservations).
          status = 'confirmed'
          and internal.module_enabled(club_id, 'bookings')
          and person_id = (select auth.uid())
          and coach_id is null
          and internal.has_role(club_id, 'student')
        )
        or (
          -- A coach booking their own lesson directly (e.g. a walk-in
          -- student who asked in person): confirmed right away.
          status = 'confirmed'
          and internal.module_enabled(club_id, 'lessons')
          and coach_id = (select auth.uid())
          and type = 'lesson'
          and internal.has_role(club_id, 'coach')
        )
        or (
          -- A student requesting a lesson from a coach: pending until the
          -- coach accepts it.
          status = 'pending'
          and internal.module_enabled(club_id, 'lessons')
          and person_id = (select auth.uid())
          and coach_id is not null
          and type = 'lesson'
          and internal.has_role(club_id, 'student')
        )
      )
    )
  );

create function public.accept_lesson_request(p_id uuid)
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

  if v_booking.status <> 'pending' then
    raise exception 'This request is no longer pending' using errcode = '22023';
  end if;

  if not (
    exists (select 1 from public.platform_admin where person_id = v_uid)
    or exists (
      select 1 from public.membership m
      where m.person_id = v_uid and m.club_id = v_booking.club_id and m.active
        and ('admin' = any (m.roles) or v_uid = v_booking.coach_id)
    )
  ) then
    raise exception 'You cannot accept this request' using errcode = '42501';
  end if;

  update public.booking set status = 'confirmed' where id = p_id;
end;
$$;

revoke all on function public.accept_lesson_request(uuid) from public, anon, authenticated;
grant execute on function public.accept_lesson_request(uuid) to authenticated;
