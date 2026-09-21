# Base de datos (Supabase)

Migraciones en `supabase/migrations/`, pruebas en `supabase/tests/`.

## Puesta en marcha (proyecto en la nube)

```bash
npx supabase login
npx supabase link --project-ref <ref>     # <ref> = texto antes de .supabase.co
npx supabase db push                      # aplica las migraciones
```

Después, en el panel: **Authentication → Hooks → Customize Access Token (JWT)
Claims** → activar, tipo *Postgres function*, `public.hook_token_acceso`.
Sin este hook el JWT no lleva club ni roles y todos terminan en `/no-club`.

Variables en `.env.local` (ver `.env.local.example`).

## Crear el primer club y el admin de plataforma

El admin de plataforma no se puede crear desde la app; se promueve por SQL
(Dashboard → SQL Editor) a una persona que ya se registró:

```sql
insert into public.admin_plataforma (persona_id)
select id from auth.users where email = 'tu@correo.com';
```

Luego esa persona (en `/platform`, cuando exista la pantalla) o tú por SQL crean
el club y la invitación del primer admin:

```sql
insert into public.club (slug, nombre) values ('mi-club', 'Mi Club');

insert into public.invitacion (club_id, email, roles)
select id, 'admin@mi-club.co', '{admin}' from public.club where slug = 'mi-club'
returning token;   -- enlace: https://<tu-dominio>/invitation/<token>
```

## Datos de prueba

```bash
node --env-file=.env.local scripts/seed-dev.mjs --yes
```

Crea un club y usuarios `*@demo.test` (contraseña `Demo1234!`) que cubren:
plataforma, admin+entrenador, alumno, varios clubes y sin club.

## Pruebas del esquema y RLS

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/esquema_y_rls.sql
```

Corre en una transacción con ROLLBACK. Úsalo contra una base local o de
desarrollo, no contra producción.

## Modelo en una línea

`persona` (cuenta) ─< `membresia` (club + `roles[]`) >─ `club`. El admin de
plataforma vive en `admin_plataforma`. Los roles se combinan (un admin puede ser
también entrenador) y una persona puede estar en varios clubes.
