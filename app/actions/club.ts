"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

// The claims (active club, roles) live in the JWT: after changing the
// membership the session must be refreshed for the proxy to see the new state.
async function refreshClaims() {
  const supabase = await createClient();
  await supabase.auth.refreshSession();
}

export async function selectClub(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const clubId = String(formData.get("club_id") ?? "");

  const supabase = await createClient();
  // RLS limits the UPDATE to the person's own row, and the composite FK
  // requires them to be a member of the club.
  const { error } = await supabase
    .from("person")
    .update({ active_club_id: clubId })
    .eq("id", session.userId);

  if (error) return { error: "No pudimos cambiar de club." };

  await refreshClaims();
  redirect("/");
}

export async function acceptInvitation(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const token = String(formData.get("token") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: "La invitación no es válida o ya expiró." };

  await refreshClaims();
  redirect("/");
}

export async function joinClub(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_club", { p_slug: slug });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "No puedes unirte a este club."
          : "No pudimos completar la solicitud.",
    };
  }

  await refreshClaims();
  redirect("/");
}
