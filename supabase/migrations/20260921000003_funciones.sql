-- Funciones expuestas como RPC y trigger de registro.
-- Todas son security definer con search_path vacío; cada una valida
-- explícitamente quién puede llamarla.

-- ---------------------------------------------------------------------------
-- Registro: crea la persona y, si el registro trae un club abierto, la
-- membresía de alumno. Funciona con confirmación de correo activa (no depende
-- de tener sesión). El rol siempre es 'alumno': admin y entrenador solo entran
-- por invitación.
-- ---------------------------------------------------------------------------

create function public.crear_persona_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_slug text := nullif(new.raw_user_meta_data ->> 'club_slug', '');
begin
  insert into public.persona (id, nombre_completo)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre_completo'), ''),
      split_part(new.email, '@', 1)
    )
  );

  if v_slug is not null then
    select id into v_club_id
    from public.club
    where slug = v_slug and registro_abierto;

    if v_club_id is not null then
      insert into public.membresia (persona_id, club_id, roles)
      values (new.id, v_club_id, array['alumno']::public.rol_club[]);

      update public.persona set club_activo_id = v_club_id where id = new.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger auth_users_crear_persona
  after insert on auth.users
  for each row execute function public.crear_persona_desde_auth();

-- ---------------------------------------------------------------------------
-- Datos públicos mínimos para las pantallas de registro e invitación
-- ---------------------------------------------------------------------------

create function public.club_publico(p_slug text)
returns table (nombre text, registro_abierto boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.nombre, c.registro_abierto from public.club c where c.slug = p_slug;
$$;

create function public.ver_invitacion(p_token text)
returns table (club_nombre text, email text, roles public.rol_club[])
language sql
stable
security definer
set search_path = ''
as $$
  select c.nombre, i.email, i.roles
  from public.invitacion i
  join public.club c on c.id = i.club_id
  where i.token = p_token
    and i.usada_en is null
    and i.expira_en > now();
$$;

-- ---------------------------------------------------------------------------
-- Unirse a un club como alumno (persona que ya tiene cuenta)
-- ---------------------------------------------------------------------------

create function public.unirse_a_club(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_club public.club%rowtype;
  v_activo boolean;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;

  select * into v_club from public.club where slug = p_slug;
  if not found then
    raise exception 'Club no encontrado' using errcode = 'P0002';
  end if;

  select activo into v_activo
  from public.membresia
  where persona_id = v_uid and club_id = v_club.id;

  if found then
    if not v_activo then
      raise exception 'Tu membresía en este club está desactivada'
        using errcode = '42501';
    end if;
    return v_club.id; -- ya es miembro: no se tocan sus roles
  end if;

  if not v_club.registro_abierto then
    raise exception 'Este club no admite registro abierto' using errcode = '42501';
  end if;

  insert into public.membresia (persona_id, club_id, roles)
  values (v_uid, v_club.id, array['alumno']::public.rol_club[]);

  update public.persona set club_activo_id = v_club.id where id = v_uid;
  return v_club.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aceptar invitación (token de un solo uso)
-- ---------------------------------------------------------------------------

create function public.aceptar_invitacion(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitacion%rowtype;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;

  select * into v_inv
  from public.invitacion
  where token = p_token
  for update;

  if not found or v_inv.usada_en is not null or v_inv.expira_en <= now() then
    raise exception 'La invitación no es válida o ya expiró' using errcode = 'P0002';
  end if;

  -- Si ya era miembro se suman los roles y se reactiva; si no, se crea.
  insert into public.membresia (persona_id, club_id, roles)
  values (v_uid, v_inv.club_id, v_inv.roles)
  on conflict (persona_id, club_id) do update
    set roles = (
          select array_agg(distinct r)
          from unnest(public.membresia.roles || excluded.roles) as r
        ),
        activo = true;

  update public.invitacion
  set usada_en = now(), usada_por = v_uid
  where id = v_inv.id;

  update public.persona set club_activo_id = v_inv.club_id where id = v_uid;
  return v_inv.club_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar reserva: la dueña, su entrenador o un admin del club
-- ---------------------------------------------------------------------------

create function public.cancelar_reserva(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_res public.reserva%rowtype;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;

  select * into v_res from public.reserva where id = p_id for update;
  if not found then
    raise exception 'Reserva no encontrada' using errcode = 'P0002';
  end if;

  if not (
    exists (select 1 from public.admin_plataforma where persona_id = v_uid)
    or exists (
      select 1 from public.membresia m
      where m.persona_id = v_uid and m.club_id = v_res.club_id and m.activo
        and (
          'admin' = any (m.roles)
          or v_uid = v_res.persona_id
          or v_uid = v_res.entrenador_id
        )
    )
  ) then
    raise exception 'No puedes cancelar esta reserva' using errcode = '42501';
  end if;

  update public.reserva set estado = 'cancelada' where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke all on function
  public.club_publico(text),
  public.ver_invitacion(text),
  public.unirse_a_club(text),
  public.aceptar_invitacion(text),
  public.cancelar_reserva(uuid)
  from public, anon, authenticated;

grant execute on function public.club_publico(text), public.ver_invitacion(text)
  to anon, authenticated;
grant execute on function
  public.unirse_a_club(text),
  public.aceptar_invitacion(text),
  public.cancelar_reserva(uuid)
  to authenticated;
