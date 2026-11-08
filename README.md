# Academia de Tenis

SaaS multi-club para administrar un club de tenis: reservas de cancha, clases con
entrenador, cursos grupales, torneos y pagos con comprobante. Cada club tiene su
propio microsite público (`/club/[slug]`) y su propia configuración (canchas,
tarifas, módulos activos).

## Stack

- **Frontend**: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
  estricto + Tailwind CSS 4
- **Backend/DB**: Supabase (Postgres + Auth + Storage) — todo el acceso a datos
  pasa por RLS y RPCs `security definer`, no hay ORM
- **Deploy**: Vercel (app) + Supabase (proyecto hosteado)

Convenciones completas de desarrollo, alcance de cada módulo y decisiones de
producto: ver [CLAUDE.md](./CLAUDE.md).

## Requisitos previos

- Node.js 20+
- Un proyecto de Supabase (gratis sirve) — este repo no corre contra Postgres
  local, siempre apunta a un proyecto remoto
- [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar migraciones
  y generar tipos (`npm i -g supabase` o `npx supabase`)

## Instalación

```bash
npm install
cp .env.local.example .env.local
```

Completa `.env.local` con las credenciales del proyecto de Supabase (Project
Settings → API Keys):

| Variable | De dónde sale | Dónde se usa |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | API Keys | cliente (browser + server) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | API Keys | cliente (browser + server) |
| `SUPABASE_SECRET_KEY` | API Keys | solo scripts (`seed-dev.mjs`, `seed-demo.mjs`) — nunca en el navegador |

Vincula el CLI a tu proyecto y aplica el esquema:

```bash
npx supabase link --project-ref <tu-project-ref>
npx supabase db push          # aplica supabase/migrations/*.sql
npx supabase gen types typescript --project-id <tu-project-ref> > lib/database.types.ts
```

(Opcional) datos de prueba — crea un club y usuarios cubriendo cada rol:

```bash
node --env-file=.env.local scripts/seed-dev.mjs --yes
```

El script imprime los correos creados al final; la contraseña de todas las
cuentas de prueba es la misma y queda fijada en el propio script
(`scripts/seed-dev.mjs`).

## Correr en local

```bash
npm run dev
```

http://localhost:3000

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción — incluye type-check completo |
| `npm start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm test` | Pruebas unitarias (`node --test`) sobre `lib/**/*.test.ts` |

## Pruebas automatizadas

`npm test` corre sobre los módulos puros de `lib/` (agenda/slots, matching de
tarifas, combinatoria de torneos, roles, etc.) — son los únicos con pruebas
automatizadas porque no dependen de un servidor Postgres para correr. Las capas
de componentes, Server Actions y políticas RLS/RPC se verifican manualmente
contra un proyecto Supabase real, no con una suite automatizada.

Cobertura (`node --test --experimental-test-coverage`): 100% líneas/funciones,
~92% ramas, sobre los archivos de `lib/` que tienen `*.test.ts`.

## Estructura

```
app/
  (auth)/          login, registro
  (app)/
    admin/         panel de administración (route group (nav) = sidebar compartido)
    coach/         vista de entrenador
    student/       vista de alumno
  actions/         Server Actions, una por módulo de negocio
  club/[slug]/     microsite público de un club (sin login)
components/        UI compartida (shadcn-like, propia)
lib/               lógica pura y testeada (slots, tarifas, bracket de torneos, auth/roles)
supabase/
  migrations/      esquema, RLS y RPCs — una fuente de verdad, aplicado con `db push`
scripts/           seed-dev.mjs (cuentas base) y seed-demo.mjs (datos de demo)
design/            referencias de diseño exportadas de Stitch
```

## Módulos implementados

1. Auth y roles (admin, entrenador, alumno), multi-club por persona
2. Calendario de clases y reservas de cancha (con política de reserva configurable)
3. Perfil de alumno
4. Pagos — comprobante subido por el alumno, revisión manual del admin
5. Cursos — clases grupales recurrentes con cupo y asistencia
6. Torneos — eliminación directa, round robin o grupos + eliminatoria

Detalle de alcance y decisiones de cada uno en [CLAUDE.md](./CLAUDE.md).

