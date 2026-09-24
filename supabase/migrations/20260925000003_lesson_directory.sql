-- Two narrow, read-only RPCs so the lesson-request screens can show names
-- that person_select (by design) doesn't expose to a plain club member:
-- a student picking a coach, or either side seeing who's on the other end
-- of one of their own lesson bookings.

create function public.list_club_coaches(p_club uuid)
returns table (person_id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.membership m
  join public.person p on p.id = m.person_id
  where m.club_id = p_club
    and m.active
    and 'coach' = any (m.roles)
    and internal.is_member(p_club)
  order by p.full_name;
$$;

create function public.list_my_lessons(p_club uuid)
returns table (
  id uuid,
  status public.booking_status,
  starts_at timestamptz,
  ends_at timestamptz,
  court_name text,
  viewer_role public.club_role,
  counterpart_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id, b.status, b.starts_at, b.ends_at, c.name,
    case when b.person_id = auth.uid() then 'student' else 'coach' end::public.club_role,
    case when b.person_id = auth.uid() then coach.full_name else student.full_name end
  from public.booking b
  join public.court c on c.id = b.court_id
  left join public.person student on student.id = b.person_id
  left join public.person coach on coach.id = b.coach_id
  where b.club_id = p_club
    and b.type = 'lesson'
    and (b.person_id = auth.uid() or b.coach_id = auth.uid())
  order by b.starts_at;
$$;

revoke all on function public.list_club_coaches(uuid) from public, anon, authenticated;
revoke all on function public.list_my_lessons(uuid) from public, anon, authenticated;
grant execute on function public.list_club_coaches(uuid), public.list_my_lessons(uuid) to authenticated;
