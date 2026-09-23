"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const SURFACES = new Set(["clay", "hard", "grass", "carpet", "other"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseCourtFields(formData: FormData) {
  return {
    // Only the string inputs go back into FormState.fields (typed as
    // Record<string, string>, for repopulating text fields after an error);
    // the checkboxes keep their own defaultChecked from the court prop.
    fields: {
      name: text(formData, "name"),
      surface: text(formData, "surface"),
      notes: text(formData, "notes"),
    },
    covered: formData.get("covered") === "on",
    has_lighting: formData.get("has_lighting") === "on",
  };
}

export async function createCourt(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const { fields, covered, has_lighting } = parseCourtFields(formData);

  if (fields.name.length < 1) {
    return { error: "Ingresa el nombre de la cancha.", fields };
  }
  if (!SURFACES.has(fields.surface)) {
    return { error: "Elige un tipo de superficie válido.", fields };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("court").insert({
    club_id: clubId,
    name: fields.name,
    surface: fields.surface as "clay" | "hard" | "grass" | "carpet" | "other",
    covered,
    has_lighting,
    notes: fields.notes || null,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una cancha con ese nombre en este club."
          : "No pudimos crear la cancha.",
      fields,
    };
  }

  revalidatePath("/admin/settings/courts");
  return { message: "Cancha creada." };
}

export async function updateCourt(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const courtId = text(formData, "court_id");
  const { fields, covered, has_lighting } = parseCourtFields(formData);

  if (!courtId) return { error: "Cancha inválida." };
  if (fields.name.length < 1) {
    return { error: "Ingresa el nombre de la cancha.", fields };
  }
  if (!SURFACES.has(fields.surface)) {
    return { error: "Elige un tipo de superficie válido.", fields };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("court")
    .update({
      name: fields.name,
      surface: fields.surface as "clay" | "hard" | "grass" | "carpet" | "other",
      covered,
      has_lighting,
      notes: fields.notes || null,
    })
    .eq("id", courtId)
    .eq("club_id", clubId);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una cancha con ese nombre en este club."
          : "No pudimos guardar los cambios.",
      fields,
    };
  }

  revalidatePath("/admin/settings/courts");
  return { message: "Cambios guardados." };
}

export async function toggleCourtActive(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const courtId = text(formData, "court_id");
  const active = text(formData, "active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("court")
    .update({ active })
    .eq("id", courtId)
    .eq("club_id", clubId);

  if (error) return { error: "No pudimos cambiar el estado de la cancha." };

  revalidatePath("/admin/settings/courts");
  return undefined;
}

export async function deleteCourt(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const courtId = text(formData, "court_id");

  const supabase = await createClient();
  const { error } = await supabase
    .from("court")
    .delete()
    .eq("id", courtId)
    .eq("club_id", clubId);

  if (error) {
    return {
      error:
        error.code === "23503"
          ? "No puedes eliminar esta cancha porque tiene reservas o tarifas asociadas. Desactívala en su lugar."
          : "No pudimos eliminar la cancha.",
    };
  }

  revalidatePath("/admin/settings/courts");
  return undefined;
}
