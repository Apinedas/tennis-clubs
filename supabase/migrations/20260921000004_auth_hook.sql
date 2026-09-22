-- Custom Access Token Hook: adds club and role context to the JWT so
-- proxy.ts can redirect without querying the database.
--
-- Claims added:
--   is_platform_admin  boolean
--   club_count         number of active memberships
--   club_id            active club (null if none resolved)
--   club_roles         person's roles at the active club
--
-- These are only a hint for redirecting (an optimistic check). Real
-- authorization is done by RLS policies, which query the tables.
--
-- After applying this migration on a cloud project the hook has to be
-- enabled: Authentication → Hooks → Customize Access Token (JWT) Claims,
-- pointing to public.access_token_hook. Locally it's enabled via config.toml.

create function public.access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (event ->> 'user_id')::uuid;
  v_claims jsonb := event -> 'claims';
  v_active_club uuid;
  v_club uuid;
  v_roles public.club_role[];
  v_n integer;
begin
  select count(*) into v_n
  from public.membership
  where person_id = v_uid and active;

  select active_club_id into v_active_club
  from public.person where id = v_uid;

  select club_id, roles into v_club, v_roles
  from public.membership
  where person_id = v_uid and club_id = v_active_club and active;

  -- No valid active club: if there's only one membership, that's the active club.
  if v_club is null and v_n = 1 then
    select club_id, roles into v_club, v_roles
    from public.membership
    where person_id = v_uid and active;
  end if;

  v_claims := jsonb_set(v_claims, '{is_platform_admin}', to_jsonb(
    exists (select 1 from public.platform_admin where person_id = v_uid)
  ));
  v_claims := jsonb_set(v_claims, '{club_count}', to_jsonb(v_n));
  v_claims := jsonb_set(v_claims, '{club_id}', coalesce(to_jsonb(v_club), 'null'::jsonb));
  v_claims := jsonb_set(
    v_claims, '{club_roles}',
    coalesce(to_jsonb(v_roles::text[]), '[]'::jsonb)
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

revoke all on function public.access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.access_token_hook(jsonb) to supabase_auth_admin;
