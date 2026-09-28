import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { ClubModuleName } from "@/lib/modules";
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

// Gate for operational screens tied to a club module (the future booking
// grid, class schedule, tournament brackets, …). Call it right after
// requireArea, once the role check already passed: it only adds the "is this
// feature turned on for this club" check on top. Configuration screens
// (Club, Courts, Rates, People, Booking policy) are NOT gated this way —
// admins must be able to set them up before switching a module on.
export async function requireModuleEnabled(
  module: ClubModuleName,
  opts?: { back?: string },
) {
  const session = await requireSession();
  const clubId = session.context.clubId;

  const enabled = await (async () => {
    if (!clubId) return false;
    const supabase = await createClient();
    const { data } = await supabase
      .from("club_module")
      .select("active")
      .eq("club_id", clubId)
      .eq("module", module)
      .maybeSingle();
    return data?.active ?? false;
  })();

  if (!enabled) {
    const params = new URLSearchParams({ module });
    if (opts?.back) params.set("back", opts.back);
    redirect(`/module-disabled?${params.toString()}`);
  }

  return session;
}

export type Profile = {
  userId: string;
  email: string;
  fullName: string;
  clubName: string | null;
  brandColor: string | null;
  logoUrl: string | null;
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
          .select("name, brand_color, logo_url")
          .eq("id", session.context.clubId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    userId: session.userId,
    email: session.email,
    fullName: person?.full_name ?? session.email,
    clubName: club?.name ?? null,
    brandColor: club?.brand_color ?? null,
    logoUrl: club?.logo_url ?? null,
    context: session.context,
  };
}
