"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export type FormState =
  | { error?: string; message?: string; fields?: Record<string, string> }
  | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!EMAIL_RE.test(email) || !password) {
    return { error: "Ingresa tu correo y tu contraseña.", fields: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Same message for a nonexistent email and a wrong password.
    return { error: "Correo o contraseña incorrectos.", fields: { email } };
  }

  redirect(next ?? "/");
}

export async function register(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const clubSlug = text(formData, "club");
  const next = safeNext(formData.get("next"));
  const fields = { full_name: fullName, email };

  if (fullName.length < 2) {
    return { error: "Ingresa tu nombre completo.", fields };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Ingresa un correo válido.", fields };
  }
  if (password.length < MIN_PASSWORD) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`,
      fields,
    };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // With this club_slug the database trigger creates the student
      // membership. Admin and coach only join via invitation.
      data: { full_name: fullName, club_slug: clubSlug || undefined },
      emailRedirectTo: `${origin}/auth/confirm${next ? `?next=${encodeURIComponent(next)}` : ""}`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return {
        error: "Ya existe una cuenta con ese correo. Inicia sesión.",
        fields,
      };
    }
    if (error.code === "weak_password") {
      return { error: "La contraseña es demasiado débil.", fields };
    }
    return { error: "No pudimos crear la cuenta. Inténtalo de nuevo.", fields };
  }

  // No session = the project requires confirming the email.
  if (!data.session) {
    return {
      message: "Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja.",
    };
  }

  redirect(next ?? "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
