-- Esquema base multi-club.
--
-- Modelo: `persona` es la cuenta (1 por usuario de Auth); `membresia` la vincula
-- a cada club con uno o más roles. El admin de plataforma vive aparte
-- (`admin_plataforma`) porque no pertenece a ningún club.

create extension if not exists btree_gist;

create type public.rol_club as enum ('admin', 'entrenador', 'alumno');
create type public.tipo_reserva as enum ('sencillos', 'dobles', 'clase');
create type public.estado_reserva as enum ('confirmada', 'cancelada', 'bloqueada');
create type public.categoria_tarifa as enum ('socio', 'no_socio');
create type public.modulo_club as enum ('reservas', 'clases', 'tarifario_dinamico', 'torneos');

-- ---------------------------------------------------------------------------
-- Club
-- ---------------------------------------------------------------------------

create table public.club (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null,
  zona_horaria text not null default 'America/Bogota',
  registro_abierto boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Personas y membresías
-- ---------------------------------------------------------------------------

create table public.persona (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre_completo text not null,
  telefono text,
  club_activo_id uuid,
  creado_en timestamptz not null default now()
);

create table public.membresia (
  persona_id uuid not null references public.persona (id) on delete cascade,
  club_id uuid not null references public.club (id) on delete cascade,
  roles public.rol_club[] not null check (cardinality(roles) >= 1),
  numero_accion text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  primary key (persona_id, club_id)
);

create unique index membresia_numero_accion_uidx
  on public.membresia (club_id, numero_accion)
  where numero_accion is not null;

create index membresia_club_idx on public.membresia (club_id);

-- El club activo debe ser uno del que la persona es miembro. Si la membresía
-- se borra, solo se anula club_activo_id (no la persona).
alter table public.persona
  add constraint persona_club_activo_fk
  foreign key (id, club_activo_id)
  references public.membresia (persona_id, club_id)
  on delete set null (club_activo_id);

create table public.admin_plataforma (
  persona_id uuid primary key references public.persona (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create table public.invitacion (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  email text not null,
  roles public.rol_club[] not null check (cardinality(roles) >= 1),
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invitado_por uuid references public.persona (id) on delete set null,
  expira_en timestamptz not null default now() + interval '7 days',
  usada_en timestamptz,
  usada_por uuid references public.persona (id) on delete set null,
  creado_en timestamptz not null default now()
);

create index invitacion_club_idx on public.invitacion (club_id);

-- ---------------------------------------------------------------------------
-- Canchas, tarifas y módulos
-- ---------------------------------------------------------------------------

create table public.cancha (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  nombre text not null,
  superficie text,
  activa boolean not null default true,
  unique (id, club_id),
  unique (club_id, nombre)
);

create table public.tarifa (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  cancha_id uuid, -- null = aplica a todas las canchas del club
  nombre text not null,
  categoria public.categoria_tarifa not null,
  hora_inicio time not null,
  hora_fin time not null,
  dias_semana smallint[] not null default '{1,2,3,4,5,6,7}',
  precio_cop integer not null check (precio_cop >= 0),
  unique (id, club_id),
  constraint tarifa_cancha_fk foreign key (cancha_id, club_id)
    references public.cancha (id, club_id),
  check (hora_fin > hora_inicio),
  check (
    cardinality(dias_semana) >= 1
    and dias_semana <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  )
);

create index tarifa_club_idx on public.tarifa (club_id);

create table public.modulo_activo (
  club_id uuid not null references public.club (id) on delete cascade,
  modulo public.modulo_club not null,
  activo boolean not null default false,
  -- true = solo el admin de plataforma puede activarlo/desactivarlo (módulos beta)
  requiere_plataforma boolean not null default false,
  primary key (club_id, modulo)
);

-- Cada club nuevo arranca con todos los módulos registrados; solo `reservas` activo.
create function public.inicializar_modulos_club()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.modulo_activo (club_id, modulo, activo)
  select new.id, m, m = 'reservas'
  from unnest(enum_range(null::public.modulo_club)) as m;
  return new;
end;
$$;

create trigger club_inicializar_modulos
  after insert on public.club
  for each row execute function public.inicializar_modulos_club();

-- Solo el admin de plataforma puede cambiar `requiere_plataforma`.
create function public.proteger_requiere_plataforma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.requiere_plataforma is distinct from old.requiere_plataforma
     and auth.uid() is not null
     and not exists (select 1 from public.admin_plataforma where persona_id = auth.uid()) then
    raise exception 'Solo el administrador de plataforma puede cambiar requiere_plataforma'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger modulo_activo_proteger_requiere_plataforma
  before update on public.modulo_activo
  for each row execute function public.proteger_requiere_plataforma();

-- ---------------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------------

create table public.reserva (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  cancha_id uuid not null,
  persona_id uuid,          -- socio/alumno con cuenta
  nombre_invitado text,     -- visitante sin cuenta (reserva hecha en recepción)
  entrenador_id uuid,
  tipo public.tipo_reserva, -- null solo en bloqueos (mantenimiento, lluvia)
  estado public.estado_reserva not null default 'confirmada',
  inicio timestamptz not null,
  fin timestamptz not null,
  notas text,               -- en bloqueos, la etiqueta visible
  creado_por uuid default auth.uid() references public.persona (id) on delete set null,
  creado_en timestamptz not null default now(),

  -- Claves compuestas: imposible mezclar entidades de clubes distintos.
  constraint reserva_cancha_fk foreign key (cancha_id, club_id)
    references public.cancha (id, club_id),
  constraint reserva_persona_fk foreign key (persona_id, club_id)
    references public.membresia (persona_id, club_id),
  constraint reserva_entrenador_fk foreign key (entrenador_id, club_id)
    references public.membresia (persona_id, club_id),

  check (fin > inicio),
  check (persona_id is null or entrenador_id is null or persona_id <> entrenador_id),
  check (estado = 'bloqueada' or persona_id is not null or nombre_invitado is not null),
  check (estado = 'bloqueada' or tipo is not null),

  -- Una cancha no puede tener dos reservas vigentes solapadas...
  constraint reserva_sin_solape_cancha exclude using gist (
    cancha_id with =,
    tstzrange(inicio, fin) with &&
  ) where (estado <> 'cancelada'),

  -- ...ni un entrenador estar en dos lugares a la vez.
  constraint reserva_sin_solape_entrenador exclude using gist (
    entrenador_id with =,
    tstzrange(inicio, fin) with &&
  ) where (entrenador_id is not null and estado <> 'cancelada')
);

create index reserva_club_inicio_idx on public.reserva (club_id, inicio);
create index reserva_persona_idx on public.reserva (persona_id);
create index reserva_entrenador_idx on public.reserva (entrenador_id);

-- Validaciones que una FK no expresa: rol de entrenador, membresías activas y
-- cancha activa. Solo se evalúan al crear o al cambiar el campo, para no
-- impedir cancelar reservas históricas cuando alguien fue desactivado.
-- security definer: debe ver las membresías de otras personas, que RLS oculta
-- a quien inserta (p. ej. un entrenador que agenda una clase para un alumno).
create function public.validar_reserva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entrenador_id is not null
     and (tg_op = 'INSERT' or new.entrenador_id is distinct from old.entrenador_id)
     and not exists (
       select 1 from public.membresia m
       where m.persona_id = new.entrenador_id
         and m.club_id = new.club_id
         and m.activo
         and 'entrenador' = any (m.roles)
     ) then
    raise exception 'La persona no es un entrenador activo de este club'
      using errcode = '23514';
  end if;

  if new.persona_id is not null
     and (tg_op = 'INSERT' or new.persona_id is distinct from old.persona_id)
     and not exists (
       select 1 from public.membresia m
       where m.persona_id = new.persona_id
         and m.club_id = new.club_id
         and m.activo
     ) then
    raise exception 'La persona no es un miembro activo de este club'
      using errcode = '23514';
  end if;

  if new.estado = 'confirmada'
     and (tg_op = 'INSERT' or new.cancha_id is distinct from old.cancha_id)
     and not exists (
       select 1 from public.cancha c
       where c.id = new.cancha_id and c.club_id = new.club_id and c.activa
     ) then
    raise exception 'La cancha no existe en este club o no está activa'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger reserva_validar
  before insert or update on public.reserva
  for each row execute function public.validar_reserva();

-- ---------------------------------------------------------------------------
-- Integridad de administradores
-- ---------------------------------------------------------------------------

-- Un club nunca puede quedarse sin un administrador activo.
create function public.proteger_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ('admin' = any (old.roles) and old.activo) then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and 'admin' = any (new.roles) and new.activo then
    return new;
  end if;

  -- Borrado en cascada de un club completo: se permite.
  if not exists (select 1 from public.club where id = old.club_id) then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from public.membresia m
    where m.club_id = old.club_id
      and m.persona_id <> old.persona_id
      and m.activo
      and 'admin' = any (m.roles)
  ) then
    raise exception 'No se puede quitar al último administrador activo del club'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger membresia_proteger_ultimo_admin
  before update or delete on public.membresia
  for each row execute function public.proteger_ultimo_admin();
