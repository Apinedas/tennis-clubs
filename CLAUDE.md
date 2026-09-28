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

## Diseño
Referencias de diseño exportadas de Stitch están en /design
