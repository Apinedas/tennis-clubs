-- Custom Access Token Hook: agrega al JWT el contexto de club y roles para que
-- proxy.ts pueda redirigir sin consultar la base de datos.
--
-- Claims agregados:
--   es_admin_plataforma  boolean
--   n_clubes             número de membresías activas
--   club_id              club activo (null si no hay uno resuelto)
--   roles_club           roles de la persona en el club activo
--
-- Solo son una pista para redirigir (chequeo optimista). La autorización real
-- la hacen las políticas RLS, que consultan las tablas.
--
-- Después de aplicar esta migración en un proyecto en la nube hay que activar
-- el hook: Authentication → Hooks → Customize Access Token (JWT) Claims,
-- apuntando a public.hook_token_acceso. En local lo activa config.toml.

create function public.hook_token_acceso(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (event ->> 'user_id')::uuid;
  v_claims jsonb := event -> 'claims';
  v_club_activo uuid;
  v_club uuid;
  v_roles public.rol_club[];
  v_n integer;
begin
  select count(*) into v_n
  from public.membresia
  where persona_id = v_uid and activo;

  select club_activo_id into v_club_activo
  from public.persona where id = v_uid;

  select club_id, roles into v_club, v_roles
  from public.membresia
  where persona_id = v_uid and club_id = v_club_activo and activo;

  -- Sin club activo válido: si solo tiene una membresía, esa es el club activo.
  if v_club is null and v_n = 1 then
    select club_id, roles into v_club, v_roles
    from public.membresia
    where persona_id = v_uid and activo;
  end if;

  v_claims := jsonb_set(v_claims, '{es_admin_plataforma}', to_jsonb(
    exists (select 1 from public.admin_plataforma where persona_id = v_uid)
  ));
  v_claims := jsonb_set(v_claims, '{n_clubes}', to_jsonb(v_n));
  v_claims := jsonb_set(v_claims, '{club_id}', coalesce(to_jsonb(v_club), 'null'::jsonb));
  v_claims := jsonb_set(
    v_claims, '{roles_club}',
    coalesce(to_jsonb(v_roles::text[]), '[]'::jsonb)
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

revoke all on function public.hook_token_acceso(jsonb) from public, anon, authenticated;
grant execute on function public.hook_token_acceso(jsonb) to supabase_auth_admin;
