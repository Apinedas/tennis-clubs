-- Surfaces booking.notes (already existed, just never wired up) through
-- list_my_lessons: the request form's optional "what do you want to work
-- on" note, meant for the coach to read before accepting.
--
-- The return shape changes, so this has to be a drop + recreate rather than
-- create or replace (Postgres doesn't allow replacing a `returns table`
-- function with a different column list).

drop function public.list_my_lessons(uuid);

create function public.list_my_lessons(p_club uuid)
returns table (
  id uuid,
  status public.booking_status,
  starts_at timestamptz,
  ends_at timestamptz,
  court_name text,
  viewer_role public.club_role,
  counterpart_name text,
  notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id, b.status, b.starts_at, b.ends_at, c.name,
    case when b.person_id = auth.uid() then 'student' else 'coach' end::public.club_role,
    case when b.person_id = auth.uid() then coach.full_name else student.full_name end,
    b.notes
  from public.booking b
  join public.court c on c.id = b.court_id
  left join public.person student on student.id = b.person_id
  left join public.person coach on coach.id = b.coach_id
  where b.club_id = p_club
    and b.type = 'lesson'
    and (b.person_id = auth.uid() or b.coach_id = auth.uid())
  order by b.starts_at;
$$;

revoke all on function public.list_my_lessons(uuid) from public, anon, authenticated;
grant execute on function public.list_my_lessons(uuid) to authenticated;
