"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { selectApplicableRate } from "@/lib/rate-matching";
import { generateSlots } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Best-effort price lookup for display only — nothing is charged yet
// (Payments is phase 2), so an unmatched rate just shows as "to confirm"
// rather than blocking the request.
async function estimateLessonPrice(
  supabase: SupabaseServer,
  clubId: string,
  courtId: string,
  courtSurface: string,
  startsAtUtc: string,
  endsAtUtc: string,
  timeZone: string,
) {
  const { data: rates } = await supabase
    .from("rate")
    .select("*")
    .eq("club_id", clubId)
    .eq("active", true)
    .or("category.eq.member,category.is.null");

  const rate = selectApplicableRate(rates ?? [], {
    courtId,
    courtSurface,
    service: "lesson",
    startsAtUtc,
    endsAtUtc,
    timeZone,
  });
  return rate?.price_amount ?? null;
}

export async function requestLesson(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context, userId } = await requireArea("student");
  const clubId = context.clubId as string;

  const coachId = text(formData, "coach_id");
  const dateISO = text(formData, "date");
  const startsAtUtc = text(formData, "starts_at");
  const endsAtUtc = text(formData, "ends_at");
  const fields = { coach_id: coachId, date: dateISO };

  if (!coachId) return { error: "Elige un entrenador.", fields };
  if (!dateISO || !startsAtUtc || !endsAtUtc) {
    return { error: "Elige un horario disponible.", fields };
  }

  const supabase = await createClient();

  const [{ data: club }, { data: policy }, { data: existing }] = await Promise.all([
    supabase.from("club").select("timezone").eq("id", clubId).single(),
    supabase.from("booking_policy").select("*").eq("club_id", clubId).single(),
    supabase
      .from("booking")
      .select("starts_at, ends_at")
      .eq("club_id", clubId)
      .eq("coach_id", coachId)
      .neq("status", "cancelled"),
  ]);

  if (!club || !policy) return { error: "No pudimos validar el club.", fields };

  const now = new Date();
  const maxDate = new Date(now.getTime() + policy.max_advance_days * 86_400_000);
  if (new Date(startsAtUtc) > maxDate) {
    return { error: "Esa fecha supera la anticipación máxima permitida.", fields };
  }

  // Re-derive the day's valid slots server-side rather than trusting the
  // submitted timestamps outright — the client only ever offers real slots,
  // but the form data could be tampered with.
  const validSlots = generateSlots({
    dateISO,
    timeZone: club.timezone,
    slotMinutes: policy.slot_minutes,
    minAdvanceHours: policy.min_advance_hours,
    now,
    existingBookingsUtc: (existing ?? []).map((b) => ({
      startsAtUtc: b.starts_at,
      endsAtUtc: b.ends_at,
    })),
  });
  const chosen = validSlots.find(
    (s) => s.startsAtUtc === startsAtUtc && s.endsAtUtc === endsAtUtc,
  );
  if (!chosen) {
    return {
      error: "Ese horario ya no está disponible. Elige otro.",
      fields,
    };
  }

  const { data: courts } = await supabase
    .from("court")
    .select("id, surface")
    .eq("club_id", clubId)
    .eq("active", true)
    .order("name");

  if (!courts || courts.length === 0) {
    return { error: "El club no tiene canchas activas.", fields };
  }

  // Try each active court until one isn't already taken at this time; the
  // exclusion constraint is the real race-safe guard, this loop just finds
  // the first candidate that clears it.
  for (const court of courts) {
    const { error } = await supabase
      .from("booking")
      .insert({
        club_id: clubId,
        court_id: court.id,
        person_id: userId,
        coach_id: coachId,
        type: "lesson",
        status: "pending",
        starts_at: startsAtUtc,
        ends_at: endsAtUtc,
      })
      .select("id")
      .single();

    if (!error) {
      const price = await estimateLessonPrice(
        supabase,
        clubId,
        court.id,
        court.surface,
        startsAtUtc,
        endsAtUtc,
        club.timezone,
      );
      revalidatePath("/student/lessons");
      return {
        message:
          price != null
            ? `Solicitud enviada. Tarifa estimada: $${price.toLocaleString("es-CO")}.`
            : "Solicitud enviada. El club te confirmará la tarifa.",
      };
    }
    if (error.code !== "23P01") {
      return { error: "No pudimos enviar la solicitud.", fields };
    }
    // 23P01 (exclusion violation): this court is taken, try the next one.
  }

  return {
    error: "No quedan canchas libres en ese horario. Elige otro.",
    fields,
  };
}

export async function cancelMyLesson(
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
  if (error) return { error: "No pudimos cancelar la solicitud." };

  revalidatePath("/student/lessons");
  return undefined;
}

export async function respondToLessonRequest(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("coach");
  const bookingId = text(formData, "booking_id");
  const decision = text(formData, "decision"); // "accept" | "reject"

  const supabase = await createClient();
  const { error } =
    decision === "accept"
      ? await supabase.rpc("accept_lesson_request", { p_id: bookingId })
      : await supabase.rpc("cancel_booking", { p_id: bookingId });

  if (error) {
    return {
      error:
        error.code === "22023"
          ? "Esa solicitud ya no está pendiente."
          : error.code === "42501"
            ? "No puedes responder a esta solicitud."
            : "No pudimos procesar la respuesta.",
    };
  }

  revalidatePath("/coach");
  return undefined;
}
