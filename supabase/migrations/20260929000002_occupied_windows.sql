-- Fixes a gap the original RLS migration's own comment predicted and never
-- filled in: "general availability will go through a separate function so
-- as not to expose other students' names" — that function never got built,
-- so /student/book, /student/lessons and their server actions were reading
-- public.booking directly. booking_select only lets a member see rows
-- where they're person_id or coach_id, so a member's OWN slot picker never
-- saw anyone else's bookings — a court or coach could look free when it
-- wasn't. No double-booking was ever possible (booking_no_overlap_court and
-- booking_no_overlap_coach are hard exclusion constraints, unrelated to
-- RLS), but the availability shown was wrong until the insert failed.
--
-- This RPC returns only what's needed to compute free slots — never
-- person_id, guest_name or notes — so it's safe for any member to call
-- regardless of whose booking it is.

create function public.list_occupied_windows(
  p_club uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_court_ids uuid[] default null,
  p_coach_id uuid default null
)
returns table (court_id uuid, coach_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.court_id, b.coach_id, b.starts_at, b.ends_at
  from public.booking b
  where b.club_id = p_club
    and b.status <> 'cancelled'
    and b.starts_at < p_end
    and b.ends_at > p_start
    and internal.is_member(p_club)
    and (
      (p_court_ids is not null and b.court_id = any (p_court_ids))
      or (p_coach_id is not null and b.coach_id = p_coach_id)
    );
$$;

revoke all on function public.list_occupied_windows(uuid, timestamptz, timestamptz, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.list_occupied_windows(uuid, timestamptz, timestamptz, uuid[], uuid) to authenticated;
