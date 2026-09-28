"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function approvePayment(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const bookingId = text(formData, "booking_id");
  if (!bookingId) return { error: "Falta la reserva." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_booking_paid", { p_id: bookingId });
  if (error) return { error: "No pudimos aprobar el pago." };

  revalidatePath("/admin/payments");
  revalidatePath("/admin/schedule");
  return { message: "Pago aprobado." };
}

export async function rejectPayment(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const bookingId = text(formData, "booking_id");
  const note = text(formData, "note");
  if (!bookingId) return { error: "Falta la reserva." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_payment_proof", {
    p_id: bookingId,
    p_note: note || undefined,
  });
  if (error) return { error: "No pudimos rechazar el comprobante." };

  revalidatePath("/admin/payments");
  return { message: "Comprobante rechazado." };
}
