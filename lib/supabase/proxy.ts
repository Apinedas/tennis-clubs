import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseContext, type AuthContext } from "@/lib/auth/roles";
import { supabaseKey, supabaseUrl } from "./env";

// Refreshes the session and reads the JWT claims without querying the
// database. Returns the response with the updated cookies: if the proxy
// redirects, it must copy them onto the redirect (see withCookies).
export async function readSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const context: AuthContext | null = data?.claims
    ? parseContext(data.claims as Record<string, unknown>)
    : null;

  return { response: () => response, context };
}

export function withCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}
