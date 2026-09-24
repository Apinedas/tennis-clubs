"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const MIN_PASSWORD = 8;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateProfile(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireArea("student");

  const fullName = text(formData, "full_name");
  const phone = text(formData, "phone");
  const fields = { full_name: fullName, phone };

  if (fullName.length < 2) {
    return { error: "Ingresa tu nombre completo.", fields };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("person")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", session.userId);

  if (error) {
    return { error: "No pudimos guardar los cambios.", fields };
  }

  revalidatePath("/student/profile");
  return { message: "Cambios guardados." };
}

export async function changePassword(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("student");

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` };
  }
  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "No pudimos actualizar la contraseña." };
  }

  return { message: "Contraseña actualizada." };
}
