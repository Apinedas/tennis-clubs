"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

function int(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isInteger(value) ? value : NaN;
}

export async function updateBookingPolicy(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;

  const slotMinutes = int(formData, "slot_minutes");
  const minAdvanceHours = int(formData, "min_advance_hours");
  const maxAdvanceDays = int(formData, "max_advance_days");
  const cancellationHours = int(formData, "cancellation_hours");
  const selfCancelAllowed = formData.get("self_cancel_allowed") === "on";
  const acceptGuests = formData.get("accept_guests") === "on";

  const fields = {
    slot_minutes: String(formData.get("slot_minutes") ?? ""),
    min_advance_hours: String(formData.get("min_advance_hours") ?? ""),
    max_advance_days: String(formData.get("max_advance_days") ?? ""),
    cancellation_hours: String(formData.get("cancellation_hours") ?? ""),
  };

  if (!(slotMinutes > 0 && slotMinutes <= 480)) {
    return { error: "La duración del turno debe estar entre 1 y 480 minutos.", fields };
  }
  if (!(minAdvanceHours >= 0 && minAdvanceHours <= 720)) {
    return { error: "La anticipación mínima debe estar entre 0 y 720 horas.", fields };
  }
  if (!(maxAdvanceDays >= 1 && maxAdvanceDays <= 365)) {
    return { error: "La anticipación máxima debe estar entre 1 y 365 días.", fields };
  }
  if (!(cancellationHours >= 0 && cancellationHours <= 720)) {
    return { error: "Las horas de cancelación deben estar entre 0 y 720.", fields };
  }
  if (!(minAdvanceHours < maxAdvanceDays * 24)) {
    return {
      error: "La anticipación mínima no puede superar la ventana máxima de reserva.",
      fields,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("booking_policy")
    .update({
      slot_minutes: slotMinutes,
      min_advance_hours: minAdvanceHours,
      max_advance_days: maxAdvanceDays,
      cancellation_hours: cancellationHours,
      self_cancel_allowed: selfCancelAllowed,
      accept_guests: acceptGuests,
    })
    .eq("club_id", clubId);

  if (error) return { error: "No pudimos guardar los cambios.", fields };

  revalidatePath("/admin/settings/booking-policy");
  return { message: "Cambios guardados." };
}
