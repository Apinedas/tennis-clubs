-- Pruebas de esquema, RLS y casos borde. Corren dentro de una transacción que
-- termina en ROLLBACK, así que no dejan datos.
--
-- Uso (contra una base con las migraciones aplicadas, como superusuario):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/schema_and_rls.sql
-- Cualquier fallo aborta el script con el nombre de la prueba.

begin;

create schema t;
grant usage on schema t to public;

create function t.u(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

create function t.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, true);
  execute 'reset role';
  execute 'set local role authenticated';
end $$;

create function t.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'reset role';
  execute 'set local role anon';
end $$;

create function t.superuser() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'reset role';
end $$;

create function t.ok(label text) returns void language plpgsql as $$
begin raise notice 'ok - %', label; end $$;

-- La sentencia debe fallar con ese SQLSTATE.
create function t.fails(sql text, expected text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlstate <> expected then
      raise exception 'FALLA "%": esperaba %, obtuve % (%)', label, expected, sqlstate, sqlerrm;
    end if;
    perform t.ok(label);
    return;
  end;
  raise exception 'FALLA "%": la sentencia no falló', label;
end $$;

-- La consulta debe devolver exactamente n filas.
create function t.rows(sql text, n int, label text) returns void language plpgsql as $$
declare c int;
begin
  execute 'select count(*) from (' || sql || ') q' into c;
  if c <> n then
    raise exception 'FALLA "%": esperaba % filas, obtuve %', label, n, c;
  end if;
  perform t.ok(label);
end $$;

-- El DML debe afectar exactamente n filas.
create function t.affects(sql text, n int, label text) returns void language plpgsql as $$
declare c int;
begin
  execute sql;
  get diagnostics c = row_count;
  if c <> n then
    raise exception 'FALLA "%": esperaba % filas afectadas, obtuve %', label, n, c;
  end if;
  perform t.ok(label);
end $$;

-- ---------------------------------------------------------------------------
-- Datos de prueba (como superusuario)
--   1 sup    admin de plataforma
--   2 ana    admin + coach en A (única admin de A)
--   3 beto   student en A
--   4 carla  student en A, admin en B (única admin de B)
--   5 dani   coach en A
--   6 eva    student en B
-- ---------------------------------------------------------------------------

insert into public.club (id, slug, name, open_registration) values
  (t.u(101), 'club-a', 'Club A', true),
  (t.u(102), 'club-b', 'Club B', true),
  (t.u(103), 'club-c', 'Club C', false);

insert into auth.users (id, email) values
  (t.u(1), 'sup@x.co'), (t.u(2), 'ana@x.co'), (t.u(3), 'beto@x.co'),
  (t.u(4), 'carla@x.co'), (t.u(5), 'dani@x.co'), (t.u(6), 'eva@x.co'),
  (t.u(7), 'fran@x.co');

insert into public.platform_admin (person_id) values (t.u(1));

insert into public.membership (person_id, club_id, roles) values
  (t.u(2), t.u(101), '{admin,coach}'),
  (t.u(3), t.u(101), '{student}'),
  (t.u(4), t.u(101), '{student}'),
  (t.u(4), t.u(102), '{admin}'),
  (t.u(5), t.u(101), '{coach}'),
  (t.u(6), t.u(102), '{student}');

update public.person set active_club_id = t.u(101) where id = t.u(2);

insert into public.court (id, club_id, name, surface) values
  (t.u(201), t.u(101), 'Cancha 1', 'clay'),
  (t.u(202), t.u(101), 'Cancha 2', 'clay'),
  (t.u(203), t.u(102), 'Cancha B1', 'hard');

-- ---------------------------------------------------------------------------
-- Registro y módulos
-- ---------------------------------------------------------------------------

select t.rows($$select 1 from public.person$$, 7, 'el trigger crea una persona por usuario');

select t.rows($$select 1 from public.club_module where club_id = t.u(101)$$, 4,
  'un club nuevo tiene los 4 módulos');
select t.rows($$select 1 from public.club_module where club_id = t.u(101) and active$$, 1,
  'solo bookings viene activo');

insert into auth.users (id, email, raw_user_meta_data) values
  (t.u(8), 'gus@x.co', '{"club_slug":"club-a","full_name":"Gus Pérez"}'),
  (t.u(9), 'hana@x.co', '{"club_slug":"club-c"}'),
  (t.u(10), 'ivan@x.co', '{"club_slug":"no-existe"}');

select t.rows($$select 1 from public.membership where person_id = t.u(8) and roles = '{student}' and club_id = t.u(101)$$, 1,
  'registro con club abierto crea membresía de student');
select t.rows($$select 1 from public.person where id = t.u(8) and active_club_id = t.u(101) and full_name = 'Gus Pérez'$$, 1,
  'registro fija club activo y nombre');
select t.rows($$select 1 from public.membership where person_id in (t.u(9), t.u(10))$$, 0,
  'club cerrado o inexistente no crea membresía');

-- ---------------------------------------------------------------------------
-- Aislamiento por rol (RLS)
-- ---------------------------------------------------------------------------

select t.anon();
select t.fails($$select * from public.club$$, '42501', 'anon no lee club');
select t.fails($$select * from public.booking$$, '42501', 'anon no lee booking');
select t.rows($$select * from public.public_club('club-a')$$, 1, 'anon ve datos públicos del club');

select t.as_user(t.u(3)); -- beto, student de A
select t.rows($$select 1 from public.club$$, 1, 'student solo ve su club');
select t.rows($$select 1 from public.person$$, 1, 'student solo ve su propia persona');
select t.rows($$select 1 from public.membership$$, 1, 'student solo ve su membresía');
select t.rows($$select 1 from public.court$$, 2, 'student ve las canchas de su club, no las de B');
select t.affects($$update public.membership set roles = '{admin}' where person_id = t.u(3)$$, 0,
  'student no puede subirse a admin');
select t.fails($$insert into public.membership (person_id, club_id, roles) values (t.u(3), t.u(102), '{admin}')$$, '42501',
  'student no puede crearse una membresía');
select t.fails($$update public.person set active_club_id = t.u(102) where id = t.u(3)$$, '23503',
  'no se puede activar un club del que no se es miembro');
select t.affects($$update public.person set phone = '300' where id = t.u(3)$$, 1, 'student edita su teléfono');
select t.affects($$update public.person set phone = 'x' where id = t.u(2)$$, 0, 'student no edita a otra persona');
select t.fails($$update public.person set id = t.u(99) where id = t.u(3)$$, '42501', 'no se puede reescribir el id');
select t.fails($$insert into public.club (slug, name) values ('otro','Otro')$$, '42501', 'student no crea clubes');
select t.fails($$insert into public.court (club_id, name, surface) values (t.u(101), 'Nueva', 'clay')$$, '42501', 'student no crea canchas');
select t.rows($$select 1 from public.invitation$$, 0, 'student no ve invitaciones');
select t.rows($$select 1 from public.platform_admin$$, 0, 'student no ve admins de plataforma');

select t.as_user(t.u(2)); -- ana, admin+coach de A
select t.rows($$select 1 from public.person$$, 5,
  'admin ve a las personas de su club (ana, beto, carla, dani, gus), no a eva ni sup');
select t.rows($$select 1 from public.club$$, 1, 'admin solo ve su club');
select t.fails($$insert into public.club (slug, name) values ('otro','Otro')$$, '42501', 'admin de club no crea clubes');

-- Cambios de módulos: normales sí, beta (platform_only) no.
select t.affects($$update public.club_module set active = true where club_id = t.u(101) and module = 'lessons'$$, 1,
  'admin activa un módulo normal');
select t.fails($$update public.club_module set platform_only = true where club_id = t.u(101) and module = 'tournaments'$$, '42501',
  'admin no puede marcar un módulo como beta');
select t.as_user(t.u(1));
select t.affects($$update public.club_module set platform_only = true where club_id = t.u(101) and module = 'tournaments'$$, 1,
  'plataforma marca un módulo como beta');
select t.as_user(t.u(2));
select t.affects($$update public.club_module set active = true where club_id = t.u(101) and module = 'tournaments'$$, 0,
  'admin no activa un módulo beta');

-- ---------------------------------------------------------------------------
-- Reservas: RLS, restricciones y validaciones
-- ---------------------------------------------------------------------------

select t.as_user(t.u(3)); -- beto
select t.affects($$insert into public.booking (id, club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(301), t.u(101), t.u(201), t.u(3), 'singles', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, 1,
  'student reserva para sí mismo');
select t.fails($$insert into public.booking (club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(101), t.u(202), t.u(4), 'singles', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, '42501',
  'student no reserva a nombre de otro');
select t.fails($$insert into public.booking (club_id, court_id, person_id, type, status, starts_at, ends_at)
  values (t.u(101), t.u(202), t.u(3), 'singles', 'blocked', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, '42501',
  'student no crea bloqueos');
select t.fails($$insert into public.booking (club_id, court_id, person_id, coach_id, type, starts_at, ends_at)
  values (t.u(101), t.u(202), t.u(3), t.u(5), 'lesson', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, '42501',
  'student no se asigna coach por su cuenta');
select t.fails($$insert into public.booking (club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(101), t.u(201), t.u(3), 'doubles', '2030-01-01 10:30+00', '2030-01-01 11:30+00')$$, '23P01',
  'no se solapan dos reservas en la misma cancha');
select t.affects($$insert into public.booking (club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(101), t.u(201), t.u(3), 'doubles', '2030-01-01 11:00+00', '2030-01-01 12:00+00')$$, 1,
  'reservas contiguas sí caben');
select t.rows($$select 1 from public.booking$$, 2, 'student ve solo sus reservas');

select t.as_user(t.u(4)); -- carla, otra student de A
select t.rows($$select 1 from public.booking$$, 0, 'otra student no ve reservas ajenas');
select t.fails($$select public.cancel_booking(t.u(301))$$, '42501', 'otra student no puede cancelar la reserva de beto');

select t.as_user(t.u(3));
select t.rows($$select 1 from (select public.cancel_booking(t.u(301))) x$$, 1, 'la dueña cancela su reserva');
select t.affects($$insert into public.booking (club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(101), t.u(201), t.u(3), 'singles', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, 1,
  'una reserva cancelada libera la cancha');

-- Reserva con el módulo apagado
select t.as_user(t.u(2));
select t.affects($$update public.club_module set active = false where club_id = t.u(101) and module = 'bookings'$$, 1,
  'admin apaga el módulo de reservas');
select t.as_user(t.u(3));
select t.fails($$insert into public.booking (club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(101), t.u(202), t.u(3), 'singles', '2030-01-02 10:00+00', '2030-01-02 11:00+00')$$, '42501',
  'con el módulo de reservas apagado el student no reserva');
select t.as_user(t.u(2));
select t.affects($$update public.club_module set active = true where club_id = t.u(101) and module = 'bookings'$$, 1,
  'admin reactiva reservas');

-- Admin: invitados, bloqueos y coaches
select t.affects($$insert into public.booking (club_id, court_id, guest_name, type, starts_at, ends_at)
  values (t.u(101), t.u(202), 'Visitante Juan', 'singles', '2030-01-03 10:00+00', '2030-01-03 11:00+00')$$, 1,
  'admin reserva para un visitante sin cuenta');
select t.affects($$insert into public.booking (club_id, court_id, status, notes, starts_at, ends_at)
  values (t.u(101), t.u(202), 'blocked', 'Lluvia', '2030-01-04 10:00+00', '2030-01-04 18:00+00')$$, 1,
  'admin crea un bloqueo sin persona ni tipo');
select t.fails($$insert into public.booking (club_id, court_id, type, starts_at, ends_at)
  values (t.u(101), t.u(202), 'singles', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'una reserva normal necesita persona o invitado');
select t.fails($$insert into public.booking (club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(101), t.u(202), t.u(3), 'singles', '2030-01-04 12:00+00', '2030-01-04 13:00+00')$$, '23P01',
  'un bloqueo impide reservar encima');
select t.fails($$insert into public.booking (club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(101), t.u(203), t.u(3), 'singles', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'no se reserva una cancha de otro club');
select t.fails($$insert into public.booking (club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(101), t.u(201), t.u(6), 'singles', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'no se reserva a nombre de un miembro de otro club');
select t.fails($$insert into public.booking (club_id, court_id, person_id, coach_id, type, starts_at, ends_at)
  values (t.u(101), t.u(201), t.u(3), t.u(4), 'lesson', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'un student no puede figurar como coach');
select t.fails($$insert into public.booking (club_id, court_id, person_id, coach_id, type, starts_at, ends_at)
  values (t.u(101), t.u(201), t.u(5), t.u(5), 'lesson', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'la misma persona no es student y coach de la reserva');
select t.affects($$insert into public.booking (club_id, court_id, person_id, coach_id, type, starts_at, ends_at)
  values (t.u(101), t.u(201), t.u(3), t.u(5), 'lesson', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, 1,
  'admin agenda una clase con coach');
select t.fails($$insert into public.booking (club_id, court_id, person_id, coach_id, type, starts_at, ends_at)
  values (t.u(101), t.u(202), t.u(4), t.u(5), 'lesson', '2030-01-05 10:30+00', '2030-01-05 11:30+00')$$, '23P01',
  'un coach no puede estar en dos clases a la vez');
select t.affects($$insert into public.booking (club_id, court_id, person_id, coach_id, type, starts_at, ends_at)
  values (t.u(101), t.u(202), t.u(3), t.u(2), 'lesson', '2030-01-05 10:30+00', '2030-01-05 11:30+00')$$, 1,
  'un admin que también es coach puede dictar clases');

select t.as_user(t.u(5)); -- dani, coach
select t.rows($$select 1 from public.booking$$, 1, 'el coach ve solo sus clases');
select t.affects($$insert into public.booking (club_id, court_id, person_id, coach_id, type, starts_at, ends_at)
  values (t.u(101), t.u(202), t.u(4), t.u(5), 'lesson', '2030-01-06 10:00+00', '2030-01-06 11:00+00')$$, 1,
  'el coach agenda su propia clase');
select t.fails($$insert into public.booking (club_id, court_id, person_id, type, starts_at, ends_at)
  values (t.u(101), t.u(202), t.u(5), 'singles', '2030-01-07 10:00+00', '2030-01-07 11:00+00')$$, '42501',
  'un coach sin rol student no reserva como student');

-- ---------------------------------------------------------------------------
-- Tarifas: integridad entre clubes
-- ---------------------------------------------------------------------------

select t.as_user(t.u(2));
select t.affects($$insert into public.rate (club_id, name, category, start_time, end_time, price_cop)
  values (t.u(101), 'Base socio', 'member', '06:00', '17:00', 15000)$$, 1, 'admin crea una tarifa para todas las canchas');
select t.fails($$insert into public.rate (club_id, court_id, name, category, start_time, end_time, price_cop)
  values (t.u(101), t.u(203), 'Mala', 'member', '06:00', '17:00', 1)$$, '23503', 'una tarifa no apunta a la cancha de otro club');
select t.fails($$insert into public.rate (club_id, name, category, start_time, end_time, price_cop)
  values (t.u(101), 'Mala', 'member', '18:00', '17:00', 1)$$, '23514', 'la franja debe tener fin posterior al inicio');

-- ---------------------------------------------------------------------------
-- Último admin y varios roles
-- ---------------------------------------------------------------------------

select t.fails($$update public.membership set roles = '{coach}' where person_id = t.u(2) and club_id = t.u(101)$$, '23514',
  'no se puede quitar el rol admin al último admin');
select t.fails($$update public.membership set active = false where person_id = t.u(2) and club_id = t.u(101)$$, '23514',
  'no se puede desactivar al último admin');
select t.fails($$delete from public.membership where person_id = t.u(2) and club_id = t.u(101)$$, '23514',
  'no se puede borrar al último admin');
select t.affects($$update public.membership set roles = '{admin,student,coach}' where person_id = t.u(2) and club_id = t.u(101)$$, 1,
  'un admin puede acumular los tres roles');
select t.affects($$update public.membership set roles = '{admin,student}' where person_id = t.u(4) and club_id = t.u(101)$$, 1,
  'admin promueve a otra persona');
select t.affects($$update public.membership set roles = '{coach}' where person_id = t.u(2) and club_id = t.u(101)$$, 1,
  'con otro admin ya se puede quitar el rol');
select t.as_user(t.u(4));
select t.affects($$update public.membership set active = false where person_id = t.u(2) and club_id = t.u(101)$$, 1,
  'la nueva admin gestiona membresías');
select t.affects($$update public.membership set active = true where person_id = t.u(2) and club_id = t.u(101)$$, 1,
  'y las reactiva');
select t.rows($$select 1 from public.club$$, 2, 'carla ve los dos clubes de los que es miembro');

-- ---------------------------------------------------------------------------
-- Invitaciones y unirse a un club
-- ---------------------------------------------------------------------------

select t.as_user(t.u(4)); -- admin de A y B
select t.affects($$insert into public.invitation (id, club_id, email, roles, token, invited_by)
  values (t.u(401), t.u(102), 'fran@x.co', '{coach,student}', 'tok-valido', t.u(4))$$, 1,
  'admin crea una invitación');
select t.fails($$insert into public.invitation (club_id, email, roles, invited_by)
  values (t.u(102), 'x@x.co', '{admin}', t.u(1))$$, '42501', 'no se puede invitar a nombre de otro');
select t.fails($$insert into public.invitation (club_id, email, roles, invited_by)
  values (t.u(103), 'x@x.co', '{admin}', t.u(4))$$, '42501', 'no se invita a un club ajeno');

select t.anon();
select t.rows($$select * from public.view_invitation('tok-valido')$$, 1, 'anon puede ver los datos de una invitación por token');
select t.rows($$select * from public.view_invitation('inventado')$$, 0, 'un token inexistente no devuelve nada');
select t.fails($$select public.accept_invitation('tok-valido')$$, '42501', 'anon no puede aceptar (permiso de ejecución)');

select t.as_user(t.u(7)); -- fran, sin clubes
select t.rows($$select 1 from public.club$$, 0, 'una persona sin membresías no ve ningún club');
select t.rows($$select 1 from (select public.accept_invitation('tok-valido')) x$$, 1, 'fran acepta la invitación');
select t.rows($$select 1 from public.membership where club_id = t.u(102) and roles @> '{student,coach}' and roles <@ '{student,coach}'$$, 1,
  'la membresía queda con ambos roles');
select t.fails($$select public.accept_invitation('tok-valido')$$, 'P0002', 'el token no se puede reutilizar');

select t.as_user(t.u(6)); -- eva, student de B
select t.fails($$select public.accept_invitation('inventado')$$, 'P0002', 'token inválido');

select t.superuser();
insert into public.invitation (club_id, email, roles, token, expires_at)
  values (t.u(102), 'eva@x.co', '{coach}', 'tok-vencido', now() - interval '1 day');
insert into public.invitation (club_id, email, roles, token)
  values (t.u(102), 'eva@x.co', '{coach}', 'tok-suma');
select t.as_user(t.u(6));
select t.fails($$select public.accept_invitation('tok-vencido')$$, 'P0002', 'una invitación vencida no se acepta');
select t.rows($$select 1 from (select public.accept_invitation('tok-suma')) x$$, 1, 'una persona existente acepta y suma rol');
select t.rows($$select 1 from public.membership where roles @> '{student,coach}' and roles <@ '{student,coach}' and person_id = t.u(6)$$, 1,
  'los roles se suman sin duplicar la membresía');

-- Unirse a un club abierto
select t.as_user(t.u(6));
select t.rows($$select 1 from (select public.join_club('club-a')) x$$, 1, 'una student existente se une a otro club abierto');
select t.fails($$select public.join_club('club-c')$$, '42501', 'un club cerrado no admite unirse');
select t.fails($$select public.join_club('no-existe')$$, 'P0002', 'club inexistente');

select t.superuser();
update public.membership set active = false where person_id = t.u(6) and club_id = t.u(101);
select t.as_user(t.u(6));
select t.fails($$select public.join_club('club-a')$$, '42501', 'una membresía desactivada no se reactiva sola');
select t.rows($$select 1 from public.booking$$, 0, 'una membresía desactivada no ve reservas');

-- ---------------------------------------------------------------------------
-- Admin de plataforma
-- ---------------------------------------------------------------------------

select t.as_user(t.u(1));
select t.rows($$select 1 from public.club$$, 3, 'plataforma ve todos los clubes');
select t.affects($$insert into public.club (slug, name) values ('club-d', 'Club D')$$, 1, 'plataforma crea clubes');
select t.rows($$select 1 from public.club_module where club_id = (select id from public.club where slug = 'club-d')$$, 4,
  'y el club nuevo trae sus módulos');
select t.rows($$select 1 from public.person$$, 10, 'plataforma ve todas las personas');
select t.fails($$insert into public.platform_admin (person_id) values (t.u(3))$$, '42501',
  'nadie se hace admin de plataforma desde la API');

select t.as_user(t.u(3));
select t.fails($$insert into public.platform_admin (person_id) values (t.u(3))$$, '42501',
  'un student tampoco puede hacerse admin de plataforma');

-- ---------------------------------------------------------------------------
-- Hook del JWT
-- ---------------------------------------------------------------------------

select t.superuser();

create function t.claims(p uuid) returns jsonb language sql as $$
  select (public.access_token_hook(jsonb_build_object('user_id', p, 'claims', '{"sub":"x"}'::jsonb))) -> 'claims'
$$;

do $$
declare c jsonb;
begin
  c := t.claims(t.u(2));
  if not (c ->> 'club_id' = t.u(101)::text and c -> 'club_roles' = '["coach"]'::jsonb
          and (c ->> 'club_count')::int = 1 and (c ->> 'is_platform_admin')::boolean = false) then
    raise exception 'FALLA hook ana: %', c;
  end if;
  perform t.ok('hook: club activo y roles');

  c := t.claims(t.u(4));
  if not (c -> 'club_id' = 'null'::jsonb and c -> 'club_roles' = '[]'::jsonb and (c ->> 'club_count')::int = 2) then
    raise exception 'FALLA hook carla (varios clubes, sin activo): %', c;
  end if;
  perform t.ok('hook: varios clubes sin club activo deja club_id en null');

  update public.person set active_club_id = t.u(102) where id = t.u(4);
  c := t.claims(t.u(4));
  if not (c ->> 'club_id' = t.u(102)::text and c -> 'club_roles' = '["admin"]'::jsonb) then
    raise exception 'FALLA hook carla con club activo: %', c;
  end if;
  perform t.ok('hook: usa el club activo elegido');

  update public.membership set roles = '{admin,coach}' where person_id = t.u(2) and club_id = t.u(101);
  update public.membership set active = false where person_id = t.u(4) and club_id = t.u(101);
  update public.person set active_club_id = t.u(101) where id = t.u(4);
  c := t.claims(t.u(4));
  if not (c ->> 'club_id' = t.u(102)::text) then
    raise exception 'FALLA hook con club activo desactivado: %', c;
  end if;
  perform t.ok('hook: si el club activo se desactivó cae al único club activo');

  c := t.claims(t.u(1));
  if not ((c ->> 'is_platform_admin')::boolean and (c ->> 'club_count')::int = 0 and c -> 'club_id' = 'null'::jsonb) then
    raise exception 'FALLA hook plataforma: %', c;
  end if;
  perform t.ok('hook: admin de plataforma sin clubes');

  c := t.claims(t.u(9));
  if not ((c ->> 'club_count')::int = 0 and c -> 'club_roles' = '[]'::jsonb) then
    raise exception 'FALLA hook sin membresías: %', c;
  end if;
  perform t.ok('hook: persona sin membresías');
end $$;

-- ---------------------------------------------------------------------------
-- Gestión de canchas
-- ---------------------------------------------------------------------------

select t.as_user(t.u(2)); -- ana, admin de A
select t.fails($$insert into public.court (club_id, name, surface) values (t.u(101), 'Cancha 1', 'clay')$$, '23505',
  'no se puede repetir el nombre de una cancha en el mismo club');
select t.affects($$insert into public.court (id, club_id, name, surface, covered, has_lighting, notes)
  values (t.u(204), t.u(101), 'Cancha 4', 'hard', true, true, 'Techada nueva')$$, 1,
  'admin crea una cancha nueva');
select t.affects($$update public.court set covered = true, has_lighting = false, notes = 'Sin luces por ahora' where id = t.u(202)$$, 1,
  'admin edita una cancha existente');
select t.fails($$update public.court set surface = 'clay-court' where id = t.u(202)$$, '22P02',
  'un valor de superficie fuera del catálogo se rechaza');
select t.affects($$delete from public.court where id = t.u(204)$$, 1,
  'se puede borrar una cancha sin reservas ni tarifas');
select t.fails($$delete from public.court where id = t.u(201)$$, '23503',
  'no se puede borrar una cancha con reservas asociadas');
select t.affects($$update public.court set active = false where id = t.u(201)$$, 1,
  'en su lugar, se desactiva');

select t.as_user(t.u(3)); -- beto, student de A
select t.affects($$update public.court set name = 'Hackeada' where id = t.u(202)$$, 0,
  'un student no puede editar canchas');
select t.affects($$delete from public.court where id = t.u(202)$$, 0,
  'un student no puede borrar canchas');

-- ---------------------------------------------------------------------------
-- Configuración del club: columnas nuevas y logos
-- ---------------------------------------------------------------------------

select t.as_user(t.u(2)); -- ana, admin de A
select t.affects($$update public.club set contact_email = 'ops@a.co', contact_phone = '+57 300', currency = 'USD', brand_color = '#123ABC' where id = t.u(101)$$, 1,
  'admin edita los ajustes de su club');
select t.fails($$update public.club set currency = 'XXX' where id = t.u(101)$$, '23514', 'moneda fuera del catálogo se rechaza');
select t.fails($$update public.club set brand_color = '123ABC' where id = t.u(101)$$, '23514', 'color de marca sin # se rechaza');
select t.fails($$update public.club set brand_color = '#12G456' where id = t.u(101)$$, '23514', 'color de marca con carácter inválido se rechaza');
select t.affects($$update public.club set contact_email = 'hack@a.co' where id = t.u(102)$$, 0,
  'admin de A no edita el club B');

select t.as_user(t.u(3)); -- beto, student de A
select t.affects($$update public.club set contact_email = 'hack@x.co' where id = t.u(101)$$, 0,
  'un student no puede editar la configuración del club');
select t.fails($$insert into storage.objects (bucket_id, name) values ('club-logos', t.u(101)::text || '/logo.png')$$, '42501',
  'un student no sube el logo de su club');

select t.as_user(t.u(2));
select t.affects($$insert into storage.objects (bucket_id, name) values ('club-logos', t.u(101)::text || '/logo.png')$$, 1,
  'el admin sube el logo de su propio club');
select t.fails($$insert into storage.objects (bucket_id, name) values ('club-logos', t.u(102)::text || '/logo.png')$$, '42501',
  'el admin de A no sube el logo del club B');
select t.affects($$delete from storage.objects where bucket_id = 'club-logos' and name = t.u(102)::text || '/logo.png'$$, 0,
  'ana no puede borrar el logo del club B');

select t.as_user(t.u(1)); -- admin de plataforma
select t.affects($$insert into storage.objects (bucket_id, name) values ('club-logos', t.u(102)::text || '/logo.png')$$, 1,
  'el admin de plataforma sube el logo de cualquier club');

select t.as_user(t.u(2));
select t.affects($$delete from storage.objects where bucket_id = 'club-logos' and name = t.u(101)::text || '/logo.png'$$, 1,
  'ana borra el logo de su propio club');

select t.anon();
select t.rows($$select 1 from storage.objects where bucket_id = 'club-logos'$$, 1, 'la lectura de logos es pública');

-- ---------------------------------------------------------------------------
-- Borrado de un club completo (cascada) no lo frena la protección de admins
-- ---------------------------------------------------------------------------

select t.superuser();
delete from public.club where id = t.u(102);
select t.ok('se puede borrar un club completo con su último admin');

rollback;
