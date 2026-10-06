-- Every course session's booking.coach_id is the head coach (create_course
-- always sets it that way) — an assistant coach is never coach_id, only
-- course.assistant_coach_id, so booking_select's "coach_id = me" clause
-- never matches them. This RPC lists a course's sessions for whichever
-- coach (head or assistant) or admin is asking.

create function public.list_course_sessions(p_course_id uuid)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, status public.booking_status)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.starts_at, b.ends_at, b.status
  from public.booking b
  join public.course c on c.id = b.course_id
  where b.course_id = p_course_id
    and (
      internal.has_role(c.club_id, 'admin')
      or internal.is_platform_admin()
      or c.head_coach_id = auth.uid()
      or c.assistant_coach_id = auth.uid()
    )
  order by b.starts_at;
$$;

revoke all on function public.list_course_sessions(uuid) from public, anon, authenticated;
grant execute on function public.list_course_sessions(uuid) to authenticated;

-- Same visibility gap for "which courses do I coach": course_select
-- already lets any club member read course rows, so a plain query
-- filtered by head/assistant works fine there — no RPC needed for that
-- part, only for the sessions.
