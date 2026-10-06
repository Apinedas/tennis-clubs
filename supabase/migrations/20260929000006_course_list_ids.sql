-- list_club_courses only returned display names (court_name, coach name),
-- not the ids the edit form needs to preselect the right <option>. Return
-- shape changes, so drop + recreate.

drop function public.list_club_courses(uuid);

create function public.list_club_courses(p_club uuid)
returns table (
  id uuid,
  name text,
  level text,
  court_id uuid,
  court_name text,
  head_coach_id uuid,
  head_coach_name text,
  assistant_coach_id uuid,
  start_date date,
  end_date date,
  weekdays smallint[],
  start_time time,
  end_time time,
  capacity integer,
  enrolled_count bigint,
  rate_id uuid,
  price_amount integer,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.name, c.level, c.court_id, co.name, c.head_coach_id, p.full_name, c.assistant_coach_id,
    c.start_date, c.end_date, c.weekdays, c.start_time, c.end_time,
    c.capacity,
    (select count(*) from public.course_enrollment ce
     where ce.course_id = c.id and ce.status in ('pending', 'active', 'pending_cancellation')),
    c.rate_id, r.price_amount,
    c.active
  from public.course c
  join public.court co on co.id = c.court_id
  join public.person p on p.id = c.head_coach_id
  left join public.rate r on r.id = c.rate_id
  where c.club_id = p_club and internal.is_member(p_club)
  order by c.start_date desc;
$$;

revoke all on function public.list_club_courses(uuid) from public, anon, authenticated;
grant execute on function public.list_club_courses(uuid) to authenticated;
