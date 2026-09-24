"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Shared by both reservation kinds (a lesson request or a court booking):
// cancel_booking() already treats them identically, so there was no reason
// for cancelMyLesson and cancelMyBooking to duplicate this.
export async function cancelMyReservation(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("student");
  const clubId = context.clubId as string;
  const bookingId = text(formData, "booking_id");

  const supabase = await createClient();
  const { data: policy } = await supabase
    .from("booking_policy")
    .select("self_cancel_allowed")
    .eq("club_id", clubId)
    .single();
  if (policy && !policy.self_cancel_allowed) {
    return { error: "Este club no permite cancelar por tu cuenta. Contáctalo directamente." };
  }

  const { error } = await supabase.rpc("cancel_booking", { p_id: bookingId });
  if (error) return { error: "No pudimos cancelar la reserva." };

  revalidatePath("/student/reservations");
  return undefined;
}
