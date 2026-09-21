-- Row Level Security.
--
-- Las funciones auxiliares consultan las tablas (fuente de verdad), no los
-- claims del JWT: un cambio de rol o una desactivación aplican de inmediato.
-- Viven en el esquema `privado`, que la API de Supabase no expone.

create schema if not exists privado;
grant usage on schema privado to authenticated;

create function privado.es_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_plataforma where persona_id = auth.uid()
  );
$$;

create function privado.es_miembro(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membresia
    where persona_id = auth.uid() and club_id = p_club and activo
  );
$$;

create function privado.tiene_rol(p_club uuid, p_rol public.rol_club)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membresia
    where persona_id = auth.uid()
      and club_id = p_club
      and activo
      and p_rol = any (roles)
  );
$$;

-- ¿Soy admin de algún club en el que también participa p_persona?
create function privado.administra_a(p_persona uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membresia yo
    join public.membresia otra on otra.club_id = yo.club_id
    where yo.persona_id = auth.uid()
      and yo.activo
      and 'admin' = any (yo.roles)
      and otra.persona_id = p_persona
  );
$$;

create function privado.modulo_activo(p_club uuid, p_modulo public.modulo_club)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select activo from public.modulo_activo
     where club_id = p_club and modulo = p_modulo),
    false
  );
$$;

revoke all on all functions in schema privado from public;
grant execute on all functions in schema privado to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios de tabla: nada para anon; lo demás lo filtran las políticas.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on public.persona, public.admin_plataforma, public.reserva to authenticated;
grant select, insert, update, delete on
  public.club, public.membresia, public.invitacion,
  public.cancha, public.tarifa, public.modulo_activo
  to authenticated;
grant insert on public.reserva to authenticated;
-- rol y club de una persona nunca los edita ella misma
grant update (nombre_completo, telefono, club_activo_id) on public.persona to authenticated;

alter table public.club enable row level security;
alter table public.persona enable row level security;
alter table public.membresia enable row level security;
alter table public.admin_plataforma enable row level security;
alter table public.invitacion enable row level security;
alter table public.cancha enable row level security;
alter table public.tarifa enable row level security;
alter table public.modulo_activo enable row level security;
alter table public.reserva enable row level security;

-- ---------------------------------------------------------------------------
-- club
-- ---------------------------------------------------------------------------

create policy club_select on public.club for select to authenticated
  using (privado.es_miembro(id) or privado.es_admin_plataforma());

create policy club_insert on public.club for insert to authenticated
  with check (privado.es_admin_plataforma());

create policy club_update on public.club for update to authenticated
  using (privado.tiene_rol(id, 'admin') or privado.es_admin_plataforma())
  with check (privado.tiene_rol(id, 'admin') or privado.es_admin_plataforma());

create policy club_delete on public.club for delete to authenticated
  using (privado.es_admin_plataforma());

-- ---------------------------------------------------------------------------
-- persona (se crea por trigger al registrarse; no hay insert ni delete)
-- ---------------------------------------------------------------------------

create policy persona_select on public.persona for select to authenticated
  using (
    id = (select auth.uid())
    or privado.es_admin_plataforma()
    or privado.administra_a(id)
  );

create policy persona_update on public.persona for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- membresia
-- ---------------------------------------------------------------------------

create policy membresia_select on public.membresia for select to authenticated
  using (
    persona_id = (select auth.uid())
    or privado.tiene_rol(club_id, 'admin')
    or privado.es_admin_plataforma()
  );

create policy membresia_insert on public.membresia for insert to authenticated
  with check (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma());

create policy membresia_update on public.membresia for update to authenticated
  using (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma())
  with check (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma());

create policy membresia_delete on public.membresia for delete to authenticated
  using (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma());

-- ---------------------------------------------------------------------------
-- admin_plataforma: solo lectura para el propio admin; se gestiona por SQL
-- ---------------------------------------------------------------------------

create policy admin_plataforma_select on public.admin_plataforma for select to authenticated
  using (persona_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- invitacion (el token se acepta con public.aceptar_invitacion, no por SELECT)
-- ---------------------------------------------------------------------------

create policy invitacion_select on public.invitacion for select to authenticated
  using (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma());

create policy invitacion_insert on public.invitacion for insert to authenticated
  with check (
    (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma())
    and invitado_por = (select auth.uid())
    and usada_en is null
  );

create policy invitacion_delete on public.invitacion for delete to authenticated
  using (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma());

-- ---------------------------------------------------------------------------
-- cancha y tarifa
-- ---------------------------------------------------------------------------

create policy cancha_select on public.cancha for select to authenticated
  using (privado.es_miembro(club_id) or privado.es_admin_plataforma());

create policy cancha_write on public.cancha for all to authenticated
  using (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma())
  with check (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma());

create policy tarifa_select on public.tarifa for select to authenticated
  using (privado.es_miembro(club_id) or privado.es_admin_plataforma());

create policy tarifa_write on public.tarifa for all to authenticated
  using (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma())
  with check (privado.tiene_rol(club_id, 'admin') or privado.es_admin_plataforma());

-- ---------------------------------------------------------------------------
-- modulo_activo: los filas las crea el trigger del club; solo se actualizan.
-- El admin del club maneja los módulos normales; los beta, la plataforma.
-- ---------------------------------------------------------------------------

create policy modulo_activo_select on public.modulo_activo for select to authenticated
  using (privado.es_miembro(club_id) or privado.es_admin_plataforma());

create policy modulo_activo_update on public.modulo_activo for update to authenticated
  using (
    privado.es_admin_plataforma()
    or (privado.tiene_rol(club_id, 'admin') and not requiere_plataforma)
  )
  with check (
    privado.es_admin_plataforma()
    or (privado.tiene_rol(club_id, 'admin') and not requiere_plataforma)
  );

-- ---------------------------------------------------------------------------
-- reserva
--   - alumno: ve y crea solo las suyas (la disponibilidad general irá por una
--     función aparte para no exponer nombres de otros alumnos)
--   - entrenador: ve las suyas y crea clases propias
--   - admin: todo el club
--   - no hay update ni delete directos: se cancela con public.cancelar_reserva
-- ---------------------------------------------------------------------------

create policy reserva_select on public.reserva for select to authenticated
  using (
    privado.es_admin_plataforma()
    or privado.tiene_rol(club_id, 'admin')
    or (
      privado.es_miembro(club_id)
      and (
        persona_id = (select auth.uid())
        or entrenador_id = (select auth.uid())
      )
    )
  );

create policy reserva_insert on public.reserva for insert to authenticated
  with check (
    privado.es_admin_plataforma()
    or privado.tiene_rol(club_id, 'admin')
    or (
      creado_por = (select auth.uid())
      and estado = 'confirmada'
      and privado.modulo_activo(club_id, 'reservas')
      and (
        (
          persona_id = (select auth.uid())
          and entrenador_id is null
          and privado.tiene_rol(club_id, 'alumno')
        )
        or (
          entrenador_id = (select auth.uid())
          and tipo = 'clase'
          and privado.tiene_rol(club_id, 'entrenador')
        )
      )
    )
  );
