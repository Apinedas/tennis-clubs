import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  allowedAreas,
  homePath,
  parseContext,
  type Area,
  type AuthContext,
} from "./roles";

// Session data access layer. The proxy does the first redirect; this is the
// second line of defense and the source of context for the screens.

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;

  const claims = data.claims as Record<string, unknown>;
  return {
    userId: String(claims.sub),
    email: typeof claims.email === "string" ? claims.email : "",
    context: parseContext(claims),
  };
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// Requires access to an area; sends them to their home if they don't have it.
export async function requireArea(area: Area) {
  const session = await requireSession();
  if (!allowedAreas(session.context).includes(area)) {
    redirect(homePath(session.context));
  }
  return session;
}

export type Profile = {
  userId: string;
  email: string;
  fullName: string;
  clubName: string | null;
  context: AuthContext;
};

export async function getProfile(): Promise<Profile> {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: person }, { data: club }] = await Promise.all([
    supabase
      .from("person")
      .select("full_name")
      .eq("id", session.userId)
      .maybeSingle(),
    session.context.clubId
      ? supabase
          .from("club")
          .select("name")
          .eq("id", session.context.clubId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    userId: session.userId,
    email: session.email,
    fullName: person?.full_name ?? session.email,
    clubName: club?.name ?? null,
    context: session.context,
  };
}
