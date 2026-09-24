"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set(["admin", "coach", "student"]);
type Role = "admin" | "coach" | "student";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseRoles(formData: FormData): Role[] {
  return formData
    .getAll("roles")
    .map(String)
    .filter((r): r is Role => ROLES.has(r));
}

// Distinct from FormState (app/actions/auth.ts): the invite panel also needs
// the generated link back, since there's no email delivery — the admin
// copies and shares it themselves.
export type InviteState =
  | { error?: string; inviteUrl?: string; fields?: Record<string, string> }
  | undefined;

export async function inviteMember(
  _: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const session = await requireArea("admin");
  const clubId = session.context.clubId as string;
  const email = text(formData, "email").toLowerCase();
  const roles = parseRoles(formData);
  const fields = { email };

  if (!EMAIL_RE.test(email)) {
    return { error: "Ingresa un correo válido.", fields };
  }
  if (roles.length < 1) {
    return { error: "Elige al menos un rol.", fields };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitation")
    .insert({ club_id: clubId, email, roles, invited_by: session.userId })
    .select("token")
    .single();

  if (error) return { error: "No pudimos crear la invitación.", fields };

  const origin = (await headers()).get("origin") ?? "";
  revalidatePath("/admin/settings/people");
  return { inviteUrl: `${origin}/invitation/${data.token}` };
}

export async function revokeInvitation(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const invitationId = text(formData, "invitation_id");

  const supabase = await createClient();
  const { error } = await supabase
    .from("invitation")
    .delete()
    .eq("id", invitationId)
    .eq("club_id", clubId);

  if (error) return { error: "No pudimos revocar la invitación." };

  revalidatePath("/admin/settings/people");
  return undefined;
}

export async function updateMember(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const personId = text(formData, "person_id");
  const roles = parseRoles(formData);
  const title = text(formData, "title");
  const fields = { title };

  if (roles.length < 1) {
    return { error: "Elige al menos un rol.", fields };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("membership")
    .update({ roles, title: title || null })
    .eq("person_id", personId)
    .eq("club_id", clubId);

  if (error) {
    return {
      error:
        error.code === "23514"
          ? "No puedes dejar al club sin administradores activos."
          : "No pudimos guardar los cambios.",
      fields,
    };
  }

  revalidatePath("/admin/settings/people");
  return { message: "Cambios guardados." };
}

export async function toggleMembershipActive(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const personId = text(formData, "person_id");
  const active = text(formData, "active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("membership")
    .update({ active })
    .eq("person_id", personId)
    .eq("club_id", clubId);

  if (error) {
    return {
      error:
        error.code === "23514"
          ? "No puedes desactivar al último administrador del club."
          : "No pudimos cambiar el estado de la membresía.",
    };
  }

  revalidatePath("/admin/settings/people");
  return undefined;
}

export async function removeMembership(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const personId = text(formData, "person_id");

  const supabase = await createClient();
  const { error } = await supabase
    .from("membership")
    .delete()
    .eq("person_id", personId)
    .eq("club_id", clubId);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "No puedes quitar a esta persona porque tiene reservas asociadas. Desactívala en su lugar.",
      };
    }
    return {
      error:
        error.code === "23514"
          ? "No puedes quitar al último administrador del club."
          : "No pudimos quitar a esta persona.",
    };
  }

  revalidatePath("/admin/settings/people");
  return undefined;
}
