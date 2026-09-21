import { NextResponse, type NextRequest } from "next/server";
import { decideRedirect } from "@/lib/auth/roles";
import { readSession, withCookies } from "@/lib/supabase/proxy";

// Redirección optimista según el rol, leyendo solo los claims del JWT (sin
// base de datos). La autorización real está en RLS y en lib/auth/dal.ts.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { response, context } = await readSession(request);

  const target = decideRedirect(pathname, search, context);
  if (!target) return response();

  return withCookies(
    NextResponse.redirect(new URL(target, request.url)),
    response(),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
