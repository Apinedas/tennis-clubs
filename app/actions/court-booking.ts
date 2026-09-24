"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { selectApplicableRate } from "@/lib/rate-matching";
import { generateSlots } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { FormState } from "./auth";

type BookingType = Database["public"]["Enums"]["booking_type"];
const TYPES = new Set<BookingType>(["singles", "doubles"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function bookCourt(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context, userId } = await requireArea("student");
  const clubId = context.clubId as string;

  const courtId = text(formData, "court_id");
  const dateISO = text(formData, "date");
  const type = text(formData, "type") as BookingType;
  const startsAtUtc = text(formData, "starts_at");
  const endsAtUtc = text(formData, "ends_at");
  const fields = { date: dateISO };

  if (!courtId || !dateISO || !startsAtUtc || !endsAtUtc) {
    return { error: "Elige una cancha y un horario disponible.", fields };
  }
  if (!TYPES.has(type)) return { error: "Elige sencillos o dobles.", fields };

  const supabase = await createClient();

  const [{ data: court }, { data: club }, { data: policy }, { data: existing }] =
    await Promise.all([
      supabase.from("court").select("id, surface").eq("id", courtId).eq("club_id", clubId).single(),
      supabase.from("club").select("timezone").eq("id", clubId).single(),
      supabase.from("booking_policy").select("*").eq("club_id", clubId).single(),
      supabase
        .from("booking")
        .select("starts_at, ends_at")
        .eq("club_id", clubId)
        .eq("court_id", courtId)
        .neq("status", "cancelled"),
    ]);

  if (!court || !club || !policy) return { error: "No pudimos validar la cancha.", fields };

  const maxDate = new Date(new Date().getTime() + policy.max_advance_days * 86_400_000);
  if (new Date(startsAtUtc) > maxDate) {
    return { error: "Esa fecha supera la anticipación máxima permitida.", fields };
  }

  // Re-derive the day's valid slots for this specific court server-side,
  // same defense as lessons: never trust the submitted timestamps outright.
  const validSlots = generateSlots({
    dateISO,
    timeZone: club.timezone,
    slotMinutes: policy.slot_minutes,
    minAdvanceHours: policy.min_advance_hours,
    now: new Date(),
    existingBookingsUtc: (existing ?? []).map((b) => ({
      startsAtUtc: b.starts_at,
      endsAtUtc: b.ends_at,
    })),
  });
  const chosen = validSlots.find(
    (s) => s.startsAtUtc === startsAtUtc && s.endsAtUtc === endsAtUtc,
  );
  if (!chosen) return { error: "Ese horario ya no está disponible. Elige otro.", fields };

  const { error } = await supabase.from("booking").insert({
    club_id: clubId,
    court_id: courtId,
    person_id: userId,
    type,
    status: "confirmed",
    starts_at: startsAtUtc,
    ends_at: endsAtUtc,
  });

  if (error) {
    return {
      error:
        error.code === "23P01"
          ? "Alguien más acaba de reservar ese horario. Elige otro."
          : "No pudimos completar la reserva.",
      fields,
    };
  }

  const { data: rates } = await supabase
    .from("rate")
    .select("*")
    .eq("club_id", clubId)
    .eq("active", true)
    .or("category.eq.member,category.is.null");
  const rate = selectApplicableRate(rates ?? [], {
    courtId,
    courtSurface: court.surface,
    service: type,
    startsAtUtc,
    endsAtUtc,
    timeZone: club.timezone,
  });

  revalidatePath("/student/book");
  return {
    message:
      rate != null
        ? `Reserva confirmada. Tarifa: $${rate.price_amount.toLocaleString("es-CO")}.`
        : "Reserva confirmada. El club te confirmará la tarifa.",
  };
}

export async function cancelMyBooking(
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

  revalidatePath("/student/book");
  return undefined;
}
