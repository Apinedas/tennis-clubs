// Contexto de autenticación y reglas de redirección por rol.
// Módulo puro (sin acceso a datos): lo usan el proxy y la capa de acceso.
//
// Los claims los agrega public.hook_token_acceso (migración 0004). Son solo
// una pista para redirigir; la autorización real es RLS en la base de datos.

export type Role = "admin" | "entrenador" | "alumno";

export type Area = "platform" | "admin" | "coach" | "student";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  entrenador: "Entrenador",
  alumno: "Alumno",
};

export type AuthContext = {
  isPlatformAdmin: boolean;
  clubCount: number;
  clubId: string | null;
  roles: Role[];
};

// Precedencia para elegir la pantalla de inicio: plataforma > admin > entrenador > alumno.
export const AREAS: { area: Area; path: string; label: string }[] = [
  { area: "platform", path: "/platform", label: "Plataforma" },
  { area: "admin", path: "/admin", label: "Administración" },
  { area: "coach", path: "/coach", label: "Entrenador" },
  { area: "student", path: "/student", label: "Alumno" },
];

const ROLE_AREA: Record<Role, Area> = {
  admin: "admin",
  entrenador: "coach",
  alumno: "student",
};

const VALID_ROLES = new Set<string>(Object.keys(ROLE_AREA));

export function parseContext(claims: Record<string, unknown>): AuthContext {
  const roles = Array.isArray(claims.roles_club)
    ? (claims.roles_club.filter(
        (r): r is Role => typeof r === "string" && VALID_ROLES.has(r),
      ) as Role[])
    : [];

  return {
    isPlatformAdmin: claims.es_admin_plataforma === true,
    clubCount: typeof claims.n_clubes === "number" ? claims.n_clubes : 0,
    clubId: typeof claims.club_id === "string" ? claims.club_id : null,
    roles: claims.club_id ? roles : [],
  };
}

export function allowedAreas(ctx: AuthContext): Area[] {
  const areas = new Set<Area>();
  if (ctx.isPlatformAdmin) areas.add("platform");
  for (const role of ctx.roles) areas.add(ROLE_AREA[role]);
  return AREAS.map((a) => a.area).filter((a) => areas.has(a));
}

export function areaPath(area: Area): string {
  return AREAS.find((a) => a.area === area)!.path;
}

export function areaOfPath(pathname: string): Area | null {
  const match = AREAS.find(
    (a) => pathname === a.path || pathname.startsWith(`${a.path}/`),
  );
  return match?.area ?? null;
}

// Pantalla de inicio de una sesión ya autenticada.
export function homePath(ctx: AuthContext): string {
  const [first] = allowedAreas(ctx);
  if (first) return areaPath(first);
  // Miembro de varios clubes sin uno activo: debe elegir.
  if (ctx.clubCount > 1) return "/select-club";
  return "/no-club";
}

// ---------------------------------------------------------------------------
// Reglas de redirección del proxy (puras, para poder probarlas sin Supabase)
// ---------------------------------------------------------------------------

const GUEST_PAGES = ["/login", "/register"];
// Accesibles con o sin sesión: confirmación de correo e invitaciones.
const PUBLIC_PREFIXES = ["/auth/", "/invitation/"];

// Devuelve la ruta a la que hay que redirigir, o null si la petición sigue.
export function decideRedirect(
  pathname: string,
  search: string,
  ctx: AuthContext | null,
): string | null {
  const isGuestPage = GUEST_PAGES.includes(pathname);
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!ctx) {
    if (isGuestPage || isPublic) return null;
    if (pathname === "/") return "/login";
    return `/login?next=${encodeURIComponent(pathname + search)}`;
  }

  const home = homePath(ctx);

  // Quien ya tiene sesión y abre el enlace de registro de un club se une a él.
  const club = new URLSearchParams(search).get("club");
  if (pathname === "/register" && club) {
    return `/join/${encodeURIComponent(club)}`;
  }
  if (pathname === "/" || isGuestPage) return home;
  if (isPublic) return null;

  const area = areaOfPath(pathname);
  if (area && !allowedAreas(ctx).includes(area)) return home;

  // Sin clubes no hay nada que elegir; con un club activo no hace falta esperar.
  if (pathname === "/select-club" && ctx.clubCount === 0) return home;
  if (pathname === "/no-club" && home !== "/no-club") return home;

  return null;
}
