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
   Incluye asistencia por sesión.
7. Torneos (fase 2, no MVP) — eliminación directa, round robin por grupos, o
   grupos + eliminatoria (los mejores de cada grupo pasan a un cuadro). La
   combinatoria (byes, sembrado, balanceo de grupos) vive en lib/bracket.ts,
   pura y testeada — la base de datos solo persiste el resultado. Cada partido
   agendado es un booking real (type='tournament').

## Diseño
Referencias de diseño exportadas de Stitch están en /design
