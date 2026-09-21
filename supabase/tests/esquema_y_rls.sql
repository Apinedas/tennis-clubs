-- Pruebas de esquema, RLS y casos borde. Corren dentro de una transacción que
-- termina en ROLLBACK, así que no dejan datos.
--
-- Uso (contra una base con las migraciones aplicadas, como superusuario):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/esquema_y_rls.sql
-- Cualquier fallo aborta el script con el nombre de la prueba.

begin;

create schema t;
grant usage on schema t to public;

create function t.u(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

create function t.como(p uuid) returns void language plpgsql as $$
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

create function t.postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'reset role';
end $$;

create function t.ok(label text) returns void language plpgsql as $$
begin raise notice 'ok - %', label; end $$;

-- La sentencia debe fallar con ese SQLSTATE.
create function t.falla(sql text, esperado text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlstate <> esperado then
      raise exception 'FALLA "%": esperaba %, obtuve % (%)', label, esperado, sqlstate, sqlerrm;
    end if;
    perform t.ok(label);
    return;
  end;
  raise exception 'FALLA "%": la sentencia no falló', label;
end $$;

-- La consulta debe devolver exactamente n filas.
create function t.filas(sql text, n int, label text) returns void language plpgsql as $$
declare c int;
begin
  execute 'select count(*) from (' || sql || ') q' into c;
  if c <> n then
    raise exception 'FALLA "%": esperaba % filas, obtuve %', label, n, c;
  end if;
  perform t.ok(label);
end $$;

-- El DML debe afectar exactamente n filas.
create function t.afecta(sql text, n int, label text) returns void language plpgsql as $$
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
--   2 ana    admin + entrenador en A (único admin de A)
--   3 beto   alumno en A
--   4 carla  alumno en A, admin en B (único admin de B)
--   5 dani   entrenador en A
--   6 eva    alumno en B
-- ---------------------------------------------------------------------------

insert into public.club (id, slug, nombre, registro_abierto) values
  (t.u(101), 'club-a', 'Club A', true),
  (t.u(102), 'club-b', 'Club B', true),
  (t.u(103), 'club-c', 'Club C', false);

insert into auth.users (id, email) values
  (t.u(1), 'sup@x.co'), (t.u(2), 'ana@x.co'), (t.u(3), 'beto@x.co'),
  (t.u(4), 'carla@x.co'), (t.u(5), 'dani@x.co'), (t.u(6), 'eva@x.co'),
  (t.u(7), 'fran@x.co');

insert into public.admin_plataforma (persona_id) values (t.u(1));

insert into public.membresia (persona_id, club_id, roles) values
  (t.u(2), t.u(101), '{admin,entrenador}'),
  (t.u(3), t.u(101), '{alumno}'),
  (t.u(4), t.u(101), '{alumno}'),
  (t.u(4), t.u(102), '{admin}'),
  (t.u(5), t.u(101), '{entrenador}'),
  (t.u(6), t.u(102), '{alumno}');

update public.persona set club_activo_id = t.u(101) where id = t.u(2);

insert into public.cancha (id, club_id, nombre) values
  (t.u(201), t.u(101), 'Cancha 1'),
  (t.u(202), t.u(101), 'Cancha 2'),
  (t.u(203), t.u(102), 'Cancha B1');

-- ---------------------------------------------------------------------------
-- Registro y módulos
-- ---------------------------------------------------------------------------

select t.filas($$select 1 from public.persona$$, 7, 'el trigger crea una persona por usuario');

select t.filas($$select 1 from public.modulo_activo where club_id = t.u(101)$$, 4,
  'un club nuevo tiene los 4 módulos');
select t.filas($$select 1 from public.modulo_activo where club_id = t.u(101) and activo$$, 1,
  'solo reservas viene activo');

insert into auth.users (id, email, raw_user_meta_data) values
  (t.u(8), 'gus@x.co', '{"club_slug":"club-a","nombre_completo":"Gus Pérez"}'),
  (t.u(9), 'hana@x.co', '{"club_slug":"club-c"}'),
  (t.u(10), 'ivan@x.co', '{"club_slug":"no-existe"}');

select t.filas($$select 1 from public.membresia where persona_id = t.u(8) and roles = '{alumno}' and club_id = t.u(101)$$, 1,
  'registro con club abierto crea membresía de alumno');
select t.filas($$select 1 from public.persona where id = t.u(8) and club_activo_id = t.u(101) and nombre_completo = 'Gus Pérez'$$, 1,
  'registro fija club activo y nombre');
select t.filas($$select 1 from public.membresia where persona_id in (t.u(9), t.u(10))$$, 0,
  'club cerrado o inexistente no crea membresía');

-- ---------------------------------------------------------------------------
-- Aislamiento por rol (RLS)
-- ---------------------------------------------------------------------------

select t.anon();
select t.falla($$select * from public.club$$, '42501', 'anon no lee club');
select t.falla($$select * from public.reserva$$, '42501', 'anon no lee reserva');
select t.filas($$select * from public.club_publico('club-a')$$, 1, 'anon ve datos públicos del club');

select t.como(t.u(3)); -- beto, alumno de A
select t.filas($$select 1 from public.club$$, 1, 'alumno solo ve su club');
select t.filas($$select 1 from public.persona$$, 1, 'alumno solo ve su propia persona');
select t.filas($$select 1 from public.membresia$$, 1, 'alumno solo ve su membresía');
select t.filas($$select 1 from public.cancha$$, 2, 'alumno ve las canchas de su club, no las de B');
select t.afecta($$update public.membresia set roles = '{admin}' where persona_id = t.u(3)$$, 0,
  'alumno no puede subirse a admin');
select t.falla($$insert into public.membresia (persona_id, club_id, roles) values (t.u(3), t.u(102), '{admin}')$$, '42501',
  'alumno no puede crearse una membresía');
select t.falla($$update public.persona set club_activo_id = t.u(102) where id = t.u(3)$$, '23503',
  'no se puede activar un club del que no se es miembro');
select t.afecta($$update public.persona set telefono = '300' where id = t.u(3)$$, 1, 'alumno edita su teléfono');
select t.afecta($$update public.persona set telefono = 'x' where id = t.u(2)$$, 0, 'alumno no edita a otra persona');
select t.falla($$update public.persona set id = t.u(99) where id = t.u(3)$$, '42501', 'no se puede reescribir el id');
select t.falla($$insert into public.club (slug, nombre) values ('otro','Otro')$$, '42501', 'alumno no crea clubes');
select t.falla($$insert into public.cancha (club_id, nombre) values (t.u(101), 'Nueva')$$, '42501', 'alumno no crea canchas');
select t.filas($$select 1 from public.invitacion$$, 0, 'alumno no ve invitaciones');
select t.filas($$select 1 from public.admin_plataforma$$, 0, 'alumno no ve admins de plataforma');

select t.como(t.u(2)); -- ana, admin+entrenador de A
select t.filas($$select 1 from public.persona$$, 5,
  'admin ve a las personas de su club (ana, beto, carla, dani, gus), no a eva ni sup');
select t.filas($$select 1 from public.club$$, 1, 'admin solo ve su club');
select t.falla($$insert into public.club (slug, nombre) values ('otro','Otro')$$, '42501', 'admin de club no crea clubes');

-- Cambios de módulos: normales sí, beta (requiere_plataforma) no.
select t.afecta($$update public.modulo_activo set activo = true where club_id = t.u(101) and modulo = 'clases'$$, 1,
  'admin activa un módulo normal');
select t.falla($$update public.modulo_activo set requiere_plataforma = true where club_id = t.u(101) and modulo = 'torneos'$$, '42501',
  'admin no puede marcar un módulo como beta');
select t.como(t.u(1));
select t.afecta($$update public.modulo_activo set requiere_plataforma = true where club_id = t.u(101) and modulo = 'torneos'$$, 1,
  'plataforma marca un módulo como beta');
select t.como(t.u(2));
select t.afecta($$update public.modulo_activo set activo = true where club_id = t.u(101) and modulo = 'torneos'$$, 0,
  'admin no activa un módulo beta');

-- ---------------------------------------------------------------------------
-- Reservas: RLS, restricciones y validaciones
-- ---------------------------------------------------------------------------

select t.como(t.u(3)); -- beto
select t.afecta($$insert into public.reserva (id, club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(301), t.u(101), t.u(201), t.u(3), 'sencillos', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, 1,
  'alumno reserva para sí mismo');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(101), t.u(202), t.u(4), 'sencillos', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, '42501',
  'alumno no reserva a nombre de otro');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, estado, inicio, fin)
  values (t.u(101), t.u(202), t.u(3), 'sencillos', 'bloqueada', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, '42501',
  'alumno no crea bloqueos');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, entrenador_id, tipo, inicio, fin)
  values (t.u(101), t.u(202), t.u(3), t.u(5), 'clase', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, '42501',
  'alumno no se asigna entrenador por su cuenta');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(101), t.u(201), t.u(3), 'dobles', '2030-01-01 10:30+00', '2030-01-01 11:30+00')$$, '23P01',
  'no se solapan dos reservas en la misma cancha');
select t.afecta($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(101), t.u(201), t.u(3), 'dobles', '2030-01-01 11:00+00', '2030-01-01 12:00+00')$$, 1,
  'reservas contiguas sí caben');
select t.filas($$select 1 from public.reserva$$, 2, 'alumno ve solo sus reservas');

select t.como(t.u(4)); -- carla, otra alumna de A
select t.filas($$select 1 from public.reserva$$, 0, 'otra alumna no ve reservas ajenas');
select t.falla($$select public.cancelar_reserva(t.u(301))$$, '42501', 'otra alumna no puede cancelar la reserva de beto');

select t.como(t.u(3));
select t.filas($$select 1 from (select public.cancelar_reserva(t.u(301))) x$$, 1, 'la dueña cancela su reserva');
select t.afecta($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(101), t.u(201), t.u(3), 'sencillos', '2030-01-01 10:00+00', '2030-01-01 11:00+00')$$, 1,
  'una reserva cancelada libera la cancha');

-- Reserva con el módulo apagado
select t.como(t.u(2));
select t.afecta($$update public.modulo_activo set activo = false where club_id = t.u(101) and modulo = 'reservas'$$, 1,
  'admin apaga el módulo de reservas');
select t.como(t.u(3));
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(101), t.u(202), t.u(3), 'sencillos', '2030-01-02 10:00+00', '2030-01-02 11:00+00')$$, '42501',
  'con el módulo de reservas apagado el alumno no reserva');
select t.como(t.u(2));
select t.afecta($$update public.modulo_activo set activo = true where club_id = t.u(101) and modulo = 'reservas'$$, 1,
  'admin reactiva reservas');

-- Admin: invitados, bloqueos y entrenadores
select t.afecta($$insert into public.reserva (club_id, cancha_id, nombre_invitado, tipo, inicio, fin)
  values (t.u(101), t.u(202), 'Visitante Juan', 'sencillos', '2030-01-03 10:00+00', '2030-01-03 11:00+00')$$, 1,
  'admin reserva para un visitante sin cuenta');
select t.afecta($$insert into public.reserva (club_id, cancha_id, estado, notas, inicio, fin)
  values (t.u(101), t.u(202), 'bloqueada', 'Lluvia', '2030-01-04 10:00+00', '2030-01-04 18:00+00')$$, 1,
  'admin crea un bloqueo sin persona ni tipo');
select t.falla($$insert into public.reserva (club_id, cancha_id, tipo, inicio, fin)
  values (t.u(101), t.u(202), 'sencillos', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'una reserva normal necesita persona o invitado');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(101), t.u(202), t.u(3), 'sencillos', '2030-01-04 12:00+00', '2030-01-04 13:00+00')$$, '23P01',
  'un bloqueo impide reservar encima');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(101), t.u(203), t.u(3), 'sencillos', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'no se reserva una cancha de otro club');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(101), t.u(201), t.u(6), 'sencillos', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'no se reserva a nombre de un miembro de otro club');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, entrenador_id, tipo, inicio, fin)
  values (t.u(101), t.u(201), t.u(3), t.u(4), 'clase', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'un alumno no puede figurar como entrenador');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, entrenador_id, tipo, inicio, fin)
  values (t.u(101), t.u(201), t.u(5), t.u(5), 'clase', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, '23514',
  'la misma persona no es alumno y entrenador de la reserva');
select t.afecta($$insert into public.reserva (club_id, cancha_id, persona_id, entrenador_id, tipo, inicio, fin)
  values (t.u(101), t.u(201), t.u(3), t.u(5), 'clase', '2030-01-05 10:00+00', '2030-01-05 11:00+00')$$, 1,
  'admin agenda una clase con entrenador');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, entrenador_id, tipo, inicio, fin)
  values (t.u(101), t.u(202), t.u(4), t.u(5), 'clase', '2030-01-05 10:30+00', '2030-01-05 11:30+00')$$, '23P01',
  'un entrenador no puede estar en dos clases a la vez');
select t.afecta($$insert into public.reserva (club_id, cancha_id, persona_id, entrenador_id, tipo, inicio, fin)
  values (t.u(101), t.u(202), t.u(3), t.u(2), 'clase', '2030-01-05 10:30+00', '2030-01-05 11:30+00')$$, 1,
  'un admin que también es entrenador puede dictar clases');

select t.como(t.u(5)); -- dani, entrenador
select t.filas($$select 1 from public.reserva$$, 1, 'el entrenador ve solo sus clases');
select t.afecta($$insert into public.reserva (club_id, cancha_id, persona_id, entrenador_id, tipo, inicio, fin)
  values (t.u(101), t.u(202), t.u(4), t.u(5), 'clase', '2030-01-06 10:00+00', '2030-01-06 11:00+00')$$, 1,
  'el entrenador agenda su propia clase');
select t.falla($$insert into public.reserva (club_id, cancha_id, persona_id, tipo, inicio, fin)
  values (t.u(101), t.u(202), t.u(5), 'sencillos', '2030-01-07 10:00+00', '2030-01-07 11:00+00')$$, '42501',
  'un entrenador sin rol alumno no reserva como alumno');

-- ---------------------------------------------------------------------------
-- Tarifas: integridad entre clubes
-- ---------------------------------------------------------------------------

select t.como(t.u(2));
select t.afecta($$insert into public.tarifa (club_id, nombre, categoria, hora_inicio, hora_fin, precio_cop)
  values (t.u(101), 'Base socio', 'socio', '06:00', '17:00', 15000)$$, 1, 'admin crea una tarifa para todas las canchas');
select t.falla($$insert into public.tarifa (club_id, cancha_id, nombre, categoria, hora_inicio, hora_fin, precio_cop)
  values (t.u(101), t.u(203), 'Mala', 'socio', '06:00', '17:00', 1)$$, '23503', 'una tarifa no apunta a la cancha de otro club');
select t.falla($$insert into public.tarifa (club_id, nombre, categoria, hora_inicio, hora_fin, precio_cop)
  values (t.u(101), 'Mala', 'socio', '18:00', '17:00', 1)$$, '23514', 'la franja debe tener fin posterior al inicio');

-- ---------------------------------------------------------------------------
-- Último admin y varios roles
-- ---------------------------------------------------------------------------

select t.falla($$update public.membresia set roles = '{entrenador}' where persona_id = t.u(2) and club_id = t.u(101)$$, '23514',
  'no se puede quitar el rol admin al último admin');
select t.falla($$update public.membresia set activo = false where persona_id = t.u(2) and club_id = t.u(101)$$, '23514',
  'no se puede desactivar al último admin');
select t.falla($$delete from public.membresia where persona_id = t.u(2) and club_id = t.u(101)$$, '23514',
  'no se puede borrar al último admin');
select t.afecta($$update public.membresia set roles = '{admin,alumno,entrenador}' where persona_id = t.u(2) and club_id = t.u(101)$$, 1,
  'un admin puede acumular los tres roles');
select t.afecta($$update public.membresia set roles = '{admin,alumno}' where persona_id = t.u(4) and club_id = t.u(101)$$, 1,
  'admin promueve a otra persona');
select t.afecta($$update public.membresia set roles = '{entrenador}' where persona_id = t.u(2) and club_id = t.u(101)$$, 1,
  'con otro admin ya se puede quitar el rol');
select t.como(t.u(4));
select t.afecta($$update public.membresia set activo = false where persona_id = t.u(2) and club_id = t.u(101)$$, 1,
  'la nueva admin gestiona membresías');
select t.afecta($$update public.membresia set activo = true where persona_id = t.u(2) and club_id = t.u(101)$$, 1,
  'y las reactiva');
select t.filas($$select 1 from public.club$$, 2, 'carla ve los dos clubes de los que es miembro');

-- ---------------------------------------------------------------------------
-- Invitaciones y unirse a un club
-- ---------------------------------------------------------------------------

select t.como(t.u(4)); -- admin de A y B
select t.afecta($$insert into public.invitacion (id, club_id, email, roles, token, invitado_por)
  values (t.u(401), t.u(102), 'fran@x.co', '{entrenador,alumno}', 'tok-valido', t.u(4))$$, 1,
  'admin crea una invitación');
select t.falla($$insert into public.invitacion (club_id, email, roles, invitado_por)
  values (t.u(102), 'x@x.co', '{admin}', t.u(1))$$, '42501', 'no se puede invitar a nombre de otro');
select t.falla($$insert into public.invitacion (club_id, email, roles, invitado_por)
  values (t.u(103), 'x@x.co', '{admin}', t.u(4))$$, '42501', 'no se invita a un club ajeno');

select t.anon();
select t.filas($$select * from public.ver_invitacion('tok-valido')$$, 1, 'anon puede ver los datos de una invitación por token');
select t.filas($$select * from public.ver_invitacion('inventado')$$, 0, 'un token inexistente no devuelve nada');
select t.falla($$select public.aceptar_invitacion('tok-valido')$$, '42501', 'anon no puede aceptar (permiso de ejecución)');

select t.como(t.u(7)); -- fran, sin clubes
select t.filas($$select 1 from public.club$$, 0, 'una persona sin membresías no ve ningún club');
select t.filas($$select 1 from (select public.aceptar_invitacion('tok-valido')) x$$, 1, 'fran acepta la invitación');
select t.filas($$select 1 from public.membresia where club_id = t.u(102) and roles @> '{alumno,entrenador}' and roles <@ '{alumno,entrenador}'$$, 1,
  'la membresía queda con ambos roles');
select t.falla($$select public.aceptar_invitacion('tok-valido')$$, 'P0002', 'el token no se puede reutilizar');

select t.como(t.u(6)); -- eva, alumna de B
select t.falla($$select public.aceptar_invitacion('inventado')$$, 'P0002', 'token inválido');

select t.postgres();
insert into public.invitacion (club_id, email, roles, token, expira_en)
  values (t.u(102), 'eva@x.co', '{entrenador}', 'tok-vencido', now() - interval '1 day');
insert into public.invitacion (club_id, email, roles, token)
  values (t.u(102), 'eva@x.co', '{entrenador}', 'tok-suma');
select t.como(t.u(6));
select t.falla($$select public.aceptar_invitacion('tok-vencido')$$, 'P0002', 'una invitación vencida no se acepta');
select t.filas($$select 1 from (select public.aceptar_invitacion('tok-suma')) x$$, 1, 'una persona existente acepta y suma rol');
select t.filas($$select 1 from public.membresia where roles @> '{alumno,entrenador}' and roles <@ '{alumno,entrenador}' and persona_id = t.u(6)$$, 1,
  'los roles se suman sin duplicar la membresía');

-- Unirse a un club abierto
select t.como(t.u(6));
select t.filas($$select 1 from (select public.unirse_a_club('club-a')) x$$, 1, 'una alumna existente se une a otro club abierto');
select t.falla($$select public.unirse_a_club('club-c')$$, '42501', 'un club cerrado no admite unirse');
select t.falla($$select public.unirse_a_club('no-existe')$$, 'P0002', 'club inexistente');

select t.postgres();
update public.membresia set activo = false where persona_id = t.u(6) and club_id = t.u(101);
select t.como(t.u(6));
select t.falla($$select public.unirse_a_club('club-a')$$, '42501', 'una membresía desactivada no se reactiva sola');
select t.filas($$select 1 from public.reserva$$, 0, 'una membresía desactivada no ve reservas');

-- ---------------------------------------------------------------------------
-- Admin de plataforma
-- ---------------------------------------------------------------------------

select t.como(t.u(1));
select t.filas($$select 1 from public.club$$, 3, 'plataforma ve todos los clubes');
select t.afecta($$insert into public.club (slug, nombre) values ('club-d', 'Club D')$$, 1, 'plataforma crea clubes');
select t.filas($$select 1 from public.modulo_activo where club_id = (select id from public.club where slug = 'club-d')$$, 4,
  'y el club nuevo trae sus módulos');
select t.filas($$select 1 from public.persona$$, 10, 'plataforma ve todas las personas');
select t.falla($$insert into public.admin_plataforma (persona_id) values (t.u(3))$$, '42501',
  'nadie se hace admin de plataforma desde la API');

select t.como(t.u(3));
select t.falla($$insert into public.admin_plataforma (persona_id) values (t.u(3))$$, '42501',
  'un alumno tampoco puede hacerse admin de plataforma');

-- ---------------------------------------------------------------------------
-- Hook del JWT
-- ---------------------------------------------------------------------------

select t.postgres();

create function t.claims(p uuid) returns jsonb language sql as $$
  select (public.hook_token_acceso(jsonb_build_object('user_id', p, 'claims', '{"sub":"x"}'::jsonb))) -> 'claims'
$$;

do $$
declare c jsonb;
begin
  c := t.claims(t.u(2));
  if not (c ->> 'club_id' = t.u(101)::text and c -> 'roles_club' = '["entrenador"]'::jsonb
          and (c ->> 'n_clubes')::int = 1 and (c ->> 'es_admin_plataforma')::boolean = false) then
    raise exception 'FALLA hook ana: %', c;
  end if;
  perform t.ok('hook: club activo y roles');

  c := t.claims(t.u(4));
  if not (c -> 'club_id' = 'null'::jsonb and c -> 'roles_club' = '[]'::jsonb and (c ->> 'n_clubes')::int = 2) then
    raise exception 'FALLA hook carla (varios clubes, sin activo): %', c;
  end if;
  perform t.ok('hook: varios clubes sin club activo deja club_id en null');

  update public.persona set club_activo_id = t.u(102) where id = t.u(4);
  c := t.claims(t.u(4));
  if not (c ->> 'club_id' = t.u(102)::text and c -> 'roles_club' = '["admin"]'::jsonb) then
    raise exception 'FALLA hook carla con club activo: %', c;
  end if;
  perform t.ok('hook: usa el club activo elegido');

  update public.membresia set roles = '{admin,entrenador}' where persona_id = t.u(2) and club_id = t.u(101);
  update public.membresia set activo = false where persona_id = t.u(4) and club_id = t.u(101);
  update public.persona set club_activo_id = t.u(101) where id = t.u(4);
  c := t.claims(t.u(4));
  if not (c ->> 'club_id' = t.u(102)::text) then
    raise exception 'FALLA hook con club activo desactivado: %', c;
  end if;
  perform t.ok('hook: si el club activo se desactivó cae al único club activo');

  c := t.claims(t.u(1));
  if not ((c ->> 'es_admin_plataforma')::boolean and (c ->> 'n_clubes')::int = 0 and c -> 'club_id' = 'null'::jsonb) then
    raise exception 'FALLA hook plataforma: %', c;
  end if;
  perform t.ok('hook: admin de plataforma sin clubes');

  c := t.claims(t.u(9));
  if not ((c ->> 'n_clubes')::int = 0 and c -> 'roles_club' = '[]'::jsonb) then
    raise exception 'FALLA hook sin membresías: %', c;
  end if;
  perform t.ok('hook: persona sin membresías');
end $$;

-- ---------------------------------------------------------------------------
-- Borrado de un club completo (cascada) no lo frena la protección de admins
-- ---------------------------------------------------------------------------

select t.postgres();
delete from public.club where id = t.u(102);
select t.ok('se puede borrar un club completo con su último admin');

rollback;
