"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CURRENCIES = new Set(["COP", "USD", "EUR", "PEN"]);
// Matches the options offered in the Stitch reference; the app itself works
// with any IANA zone, this list just keeps the picker short for the region.
const TIMEZONES = new Set([
  "America/Bogota",
  "America/Lima",
  "America/Panama",
  "America/Mexico_City",
  "America/Santiago",
]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateClubSettings(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  // The target is always the caller's active club — never a club id supplied
  // by the client — so this can only ever touch the club the session is
  // already scoped to. RLS (club admin only) is the backstop either way.
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;

  const name = text(formData, "name");
  const slug = text(formData, "slug").toLowerCase();
  const timezone = text(formData, "timezone");
  const currency = text(formData, "currency");
  const contactEmail = text(formData, "contact_email");
  const contactPhone = text(formData, "contact_phone");
  const brandColor = text(formData, "brand_color").toUpperCase();
  const fields = {
    name,
    slug,
    timezone,
    currency,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    brand_color: brandColor,
  };

  if (name.length < 2) {
    return { error: "Ingresa el nombre del club.", fields };
  }
  if (!SLUG_RE.test(slug)) {
    return {
      error: "El slug solo admite minúsculas, números y guiones medios.",
      fields,
    };
  }
  if (!TIMEZONES.has(timezone)) {
    return { error: "Elige una zona horaria válida.", fields };
  }
  if (!CURRENCIES.has(currency)) {
    return { error: "Elige una moneda válida.", fields };
  }
  if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    return { error: "El correo de contacto no es válido.", fields };
  }
  if (!/^#[0-9A-F]{6}$/.test(brandColor)) {
    return { error: "El color de marca debe ser un hex de 6 dígitos.", fields };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("club")
    .update({
      name,
      slug,
      timezone,
      currency,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      brand_color: brandColor,
    })
    .eq("id", clubId);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ese slug ya lo usa otro club. Elige otro."
          : "No pudimos guardar los cambios.",
      fields,
    };
  }

  revalidatePath("/admin/settings/club");
  return { message: "Cambios guardados." };
}
