"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

// Los claims (club activo, roles) viven en el JWT: después de cambiar la
// membresía hay que renovar la sesión para que el proxy vea el estado nuevo.
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
  // RLS limita el UPDATE a la propia persona y la FK compuesta exige que sea
  // miembro del club.
  const { error } = await supabase
    .from("persona")
    .update({ club_activo_id: clubId })
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
  const { error } = await supabase.rpc("aceptar_invitacion", { p_token: token });
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
  const { error } = await supabase.rpc("unirse_a_club", { p_slug: slug });
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
