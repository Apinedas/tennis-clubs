"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { ClubModuleName } from "@/lib/modules";
import type { FormState } from "./auth";

export async function toggleModule(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const moduleName = String(formData.get("module")) as ClubModuleName;
  const active = formData.get("active") === "true";

  const supabase = await createClient();
  // RLS silently filters out rows the caller can't touch (a platform_only
  // module, for a club admin) rather than raising an error: an empty result
  // is how we detect that case, not error.code.
  const { data, error } = await supabase
    .from("club_module")
    .update({ active })
    .eq("club_id", clubId)
    .eq("module", moduleName)
    .select();

  if (error) return { error: "No pudimos cambiar el estado del módulo." };
  if (!data || data.length === 0) {
    return { error: "Este módulo solo lo puede activar la plataforma." };
  }

  revalidatePath("/admin/settings/modules");
  return undefined;
}
