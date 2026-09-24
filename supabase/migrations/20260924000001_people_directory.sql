-- People directory: a free-text title per membership, plus the one RPC that
-- can see across `person`/`membership`/`auth.users` to expose an admin's own
-- club members' emails (which never live in `public`, by design).

alter table public.membership add column title text;

create function public.list_club_members(p_club uuid)
returns table (
  person_id uuid,
  full_name text,
  phone text,
  email text,
  title text,
  member_number text,
  roles public.club_role[],
  active boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.full_name, p.phone, u.email, m.title, m.member_number, m.roles,
    m.active, m.created_at
  from public.membership m
  join public.person p on p.id = m.person_id
  join auth.users u on u.id = p.id
  where m.club_id = p_club
    and (
      internal.has_role(p_club, 'admin')
      or internal.is_platform_admin()
    )
  order by p.full_name;
$$;

revoke all on function public.list_club_members(uuid) from public, anon, authenticated;
grant execute on function public.list_club_members(uuid) to authenticated;
