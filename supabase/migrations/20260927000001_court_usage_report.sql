-- Court usage report: two read-only, admin-only aggregations. Both group
-- inside Postgres and return a small, bounded result set — never raw
-- booking rows — so report size never scales with how much booking
-- history the club has accumulated. Both rely on booking_club_starts_at_idx
-- (club_id, starts_at), already in place since the base schema, to prune
-- to the requested range before aggregating.
--
-- No revenue figures here: estimating them would mean running the rate
-- precedence match (rate-matching.ts) per booking, which is exactly the
-- per-row cost this report is designed to avoid. No-shows aren't tracked
-- (no such status exists) — cancellations, which we do record, stand in
-- for that signal instead.

create function public.court_usage_report(p_club uuid, p_start timestamptz, p_end timestamptz)
returns table (
  court_id uuid,
  court_name text,
  surface public.court_surface,
  confirmed_count bigint,
  cancelled_count bigint,
  hours_reserved numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.surface,
    count(b.id) filter (where b.status = 'confirmed'),
    count(b.id) filter (where b.status = 'cancelled'),
    coalesce(
      sum(extract(epoch from (b.ends_at - b.starts_at)) / 3600.0)
        filter (where b.status = 'confirmed'),
      0
    )
  from public.court c
  left join public.booking b
    on b.court_id = c.id
    and b.club_id = p_club
    and b.starts_at >= p_start
    and b.starts_at < p_end
  where c.club_id = p_club
    and (internal.has_role(p_club, 'admin') or internal.is_platform_admin())
  group by c.id, c.name, c.surface
  order by c.name;
$$;

create function public.court_usage_heatmap(p_club uuid, p_start timestamptz, p_end timestamptz)
returns table (
  weekday int, -- ISO: 1=Monday..7=Sunday, in the club's own timezone
  hour int,    -- 0-23, local hour the booking starts in
  bookings_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    extract(isodow from b.starts_at at time zone club.timezone)::int,
    extract(hour from b.starts_at at time zone club.timezone)::int,
    count(*)
  from public.booking b
  join public.club club on club.id = b.club_id
  where b.club_id = p_club
    and b.status = 'confirmed'
    and b.starts_at >= p_start
    and b.starts_at < p_end
    and (internal.has_role(p_club, 'admin') or internal.is_platform_admin())
  group by 1, 2
  order by 1, 2;
$$;

revoke all on function public.court_usage_report(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.court_usage_heatmap(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function
  public.court_usage_report(uuid, timestamptz, timestamptz),
  public.court_usage_heatmap(uuid, timestamptz, timestamptz)
  to authenticated;
