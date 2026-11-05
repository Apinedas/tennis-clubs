@AGENTS.md
# Academia de Tenis — Contexto del proyecto

## Stack
- Frontend: Next.js + Tailwind
- Backend/DB: Supabase (Postgres + Auth)
- Deploy: Vercel

## Convenciones
- Componentes funcionales, TypeScript estricto
- Un commit por feature completa, mensajes en español
- URLs y identificadores de código en inglés (`/login`, `/select-club`, `/coach`); tablas, columnas y textos de UI en español

## Módulos del MVP (en orden de construcción)
1. Auth y roles (admin, entrenador, alumno)
2. Calendario de clases
3. Reservas
4. Perfil de alumno
5. Pagos (fase 2, no MVP) — construido con alcance reducido: sin pasarela, solo
   estado "pendiente de pago" con comprobante subido por el alumno y revisión
   manual del admin (aprobar/rechazar)
6. Cursos (fase 2, no MVP) — clases grupales recurrentes con cupo. Autoinscripción
   o inscripción directa por el admin, ambas con el mismo lenguaje de aprobación
   que Pagos (pending/active, baja también sujeta a aprobación). Cada sesión es
   una fila real de booking (type='course'), bloquea cancha igual que una reserva.
   Incluye asistencia por sesión. Si el curso tiene tarifa (`rate_id`), inscribirse
   exige subir comprobante en el mismo paso — el admin aprueba inscripción y pago
   juntos, una sola revisión (mismo bucket `payment-proofs` que Pagos).
7. Torneos (fase 2, no MVP) — eliminación directa, round robin por grupos, o
   grupos + eliminatoria (los mejores de cada grupo pasan a un cuadro). La
   combinatoria (byes, sembrado, balanceo de grupos) vive en lib/bracket.ts,
   pura y testeada — la base de datos solo persiste el resultado. Cada partido
   agendado es un booking real (type='tournament'). Toda inscripción propia queda
   pendiente de aprobación del admin (igual que Cursos); si el torneo tiene tarifa,
   además exige comprobante de pago en el mismo paso. Solo entries aprobadas
   (`status='active'`) entran al cuadro al generarlo.
8. Sitio de la plataforma (fase futura, aún sin nombre de producto ni diseño) —
   landing distinta del microsite de cada club (`/club/[slug]`, ya construido):
   - Reúne y lista todos los clubes de la plataforma, con acceso directo al
     microsite de cada uno.
   - Registro de usuario a nivel de plataforma (no por club) — permite
     explorar clubes sin ser socio de ninguno.
   - Ser socio de un club específico da las ventajas: tarifas de socio, y
     participación en Cursos y Torneos de ese club.
   - Depende de resolver antes el alta de clubes por autoservicio: hoy solo
     un platform admin puede crear un club (política RLS `club_insert`); no
     hay flujo de registro de club. Probablemente va junto con este módulo.

## Diseño
Referencias de diseño exportadas de Stitch están en /design
