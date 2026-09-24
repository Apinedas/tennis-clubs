"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const CATEGORIES = new Set(["", "member", "non_member"]);
const SERVICES = new Set(["", "singles", "doubles", "lesson"]);
const SURFACES = new Set(["clay", "hard", "grass", "carpet", "other"]);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseRateFields(formData: FormData) {
  const assignment = text(formData, "assignment") || "all"; // all | court | surface
  const weekdays = formData
    .getAll("weekdays")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);

  return {
    fields: {
      name: text(formData, "name"),
      assignment,
      court_id: text(formData, "court_id"),
      surface: text(formData, "surface"),
      category: text(formData, "category"),
      service: text(formData, "service"),
      start_time: text(formData, "start_time"),
      end_time: text(formData, "end_time"),
      price_amount: text(formData, "price_amount"),
      weekdays: weekdays.join(","),
    },
    weekdays,
  };
}

async function validateAndBuildRow(
  fields: ReturnType<typeof parseRateFields>["fields"],
  weekdays: number[],
  clubId: string,
) {
  if (fields.name.length < 2) return { error: "Ingresa un nombre para la tarifa." };
  if (fields.assignment === "court" && !fields.court_id) {
    return { error: "Elige una cancha." };
  }
  if (fields.assignment === "surface" && !SURFACES.has(fields.surface)) {
    return { error: "Elige un tipo de superficie." };
  }
  if (!CATEGORIES.has(fields.category)) return { error: "Categoría inválida." };
  if (!SERVICES.has(fields.service)) return { error: "Servicio inválido." };
  if (!TIME_RE.test(fields.start_time) || !TIME_RE.test(fields.end_time)) {
    return { error: "Ingresa horas válidas (HH:MM)." };
  }
  if (fields.start_time >= fields.end_time) {
    return { error: "La hora de fin debe ser posterior a la de inicio." };
  }
  if (weekdays.length < 1) {
    return { error: "Elige al menos un día de la semana." };
  }
  const price = Number(fields.price_amount);
  if (!Number.isInteger(price) || price < 0) {
    return { error: "El precio debe ser un número entero mayor o igual a cero." };
  }

  return {
    row: {
      club_id: clubId,
      name: fields.name,
      court_id: fields.assignment === "court" ? fields.court_id : null,
      surface:
        fields.assignment === "surface"
          ? (fields.surface as "clay" | "hard" | "grass" | "carpet" | "other")
          : null,
      category: (fields.category || null) as "member" | "non_member" | null,
      service: (fields.service || null) as
        | "singles"
        | "doubles"
        | "lesson"
        | null,
      start_time: fields.start_time,
      end_time: fields.end_time,
      weekdays,
      price_amount: price,
    },
  };
}

export async function createRate(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const { fields, weekdays } = parseRateFields(formData);

  const result = await validateAndBuildRow(fields, weekdays, clubId);
  if ("error" in result) return { error: result.error, fields };

  const supabase = await createClient();
  const { error } = await supabase.from("rate").insert(result.row);
  if (error) return { error: "No pudimos crear la tarifa.", fields };

  revalidatePath("/admin/settings/rates");
  return { message: "Tarifa creada." };
}

export async function updateRate(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const rateId = text(formData, "rate_id");
  const { fields, weekdays } = parseRateFields(formData);

  if (!rateId) return { error: "Tarifa inválida." };

  const result = await validateAndBuildRow(fields, weekdays, clubId);
  if ("error" in result) return { error: result.error, fields };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rate")
    .update(result.row)
    .eq("id", rateId)
    .eq("club_id", clubId);
  if (error) return { error: "No pudimos guardar los cambios.", fields };

  revalidatePath("/admin/settings/rates");
  return { message: "Cambios guardados." };
}

export async function toggleRateActive(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const rateId = text(formData, "rate_id");
  const active = text(formData, "active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("rate")
    .update({ active })
    .eq("id", rateId)
    .eq("club_id", clubId);

  if (error) return { error: "No pudimos cambiar el estado de la tarifa." };

  revalidatePath("/admin/settings/rates");
  return undefined;
}

export async function deleteRate(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const rateId = text(formData, "rate_id");

  const supabase = await createClient();
  const { error } = await supabase
    .from("rate")
    .delete()
    .eq("id", rateId)
    .eq("club_id", clubId);

  if (error) return { error: "No pudimos eliminar la tarifa." };

  revalidatePath("/admin/settings/rates");
  return undefined;
}
