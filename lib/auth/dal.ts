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

// Capa de acceso a datos de sesión. El proxy hace la primera redirección; esto
// es la segunda línea de defensa y la fuente del contexto para las pantallas.

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

// Exige acceso a un área; si no lo tiene, lo manda a su inicio.
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

  const [{ data: persona }, { data: club }] = await Promise.all([
    supabase
      .from("persona")
      .select("nombre_completo")
      .eq("id", session.userId)
      .maybeSingle(),
    session.context.clubId
      ? supabase
          .from("club")
          .select("nombre")
          .eq("id", session.context.clubId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    userId: session.userId,
    email: session.email,
    fullName: persona?.nombre_completo ?? session.email,
    clubName: club?.nombre ?? null,
    context: session.context,
  };
}
