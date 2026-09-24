// Auth context and role-based redirect rules.
// Pure module (no data access): used by the proxy and the data access layer.
//
// Claims are added by public.access_token_hook (migration 0004). They're
// only a hint for redirecting; real authorization is RLS in the database.

export type Role = "admin" | "coach" | "student";

export type Area = "platform" | "admin" | "coach" | "student";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  coach: "Entrenador",
  student: "Alumno",
};

export type AuthContext = {
  isPlatformAdmin: boolean;
  clubCount: number;
  clubId: string | null;
  roles: Role[];
};

// Precedence for picking the home screen: platform > admin > coach > student.
export const AREAS: { area: Area; path: string; label: string }[] = [
  { area: "platform", path: "/platform", label: "Plataforma" },
  { area: "admin", path: "/admin", label: "Administración" },
  { area: "coach", path: "/coach", label: "Entrenador" },
  { area: "student", path: "/student", label: "Alumno" },
];

const ROLE_AREA: Record<Role, Area> = {
  admin: "admin",
  coach: "coach",
  student: "student",
};

const VALID_ROLES = new Set<string>(Object.keys(ROLE_AREA));

export function parseContext(claims: Record<string, unknown>): AuthContext {
  const roles = Array.isArray(claims.club_roles)
    ? (claims.club_roles.filter(
        (r): r is Role => typeof r === "string" && VALID_ROLES.has(r),
      ) as Role[])
    : [];

  return {
    isPlatformAdmin: claims.is_platform_admin === true,
    clubCount: typeof claims.club_count === "number" ? claims.club_count : 0,
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

// Home screen for an already authenticated session.
export function homePath(ctx: AuthContext): string {
  const [first] = allowedAreas(ctx);
  if (first) return areaPath(first);
  // Member of several clubs with none active: must choose one.
  if (ctx.clubCount > 1) return "/select-club";
  return "/no-club";
}

// ---------------------------------------------------------------------------
// Proxy redirect rules (pure, so they can be tested without Supabase)
// ---------------------------------------------------------------------------

const GUEST_PAGES = ["/login", "/register"];
// Reachable with or without a session: email confirmation, invitations, and
// a club's public microsite.
const PUBLIC_PREFIXES = ["/auth/", "/invitation/", "/club/"];

// Returns the path to redirect to, or null if the request should proceed.
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

  // Someone with a session who opens a club's sign-up link joins that club.
  const club = new URLSearchParams(search).get("club");
  if (pathname === "/register" && club) {
    return `/join/${encodeURIComponent(club)}`;
  }
  if (pathname === "/" || isGuestPage) return home;
  if (isPublic) return null;

  const area = areaOfPath(pathname);
  if (area && !allowedAreas(ctx).includes(area)) return home;

  // No clubs to choose from; with one active club there's nothing to wait for.
  if (pathname === "/select-club" && ctx.clubCount === 0) return home;
  if (pathname === "/no-club" && home !== "/no-club") return home;

  return null;
}
