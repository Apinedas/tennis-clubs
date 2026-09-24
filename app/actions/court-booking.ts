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

type CartItem = { courtId: string; startsAtUtc: string; endsAtUtc: string };

const MAX_CART_ITEMS = 12;

// Confirms every slot the student selected in the booking cart. Each item is
// re-validated against freshly-generated slots (same defense as bookCourt),
// so one slot someone else just grabbed doesn't block the rest — it's
// simply reported as not confirmed.
export async function bookCourts(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context, userId } = await requireArea("student");
  const clubId = context.clubId as string;

  const type = text(formData, "type") as BookingType;
  const dateISO = text(formData, "date");
  const itemsRaw = text(formData, "items");

  if (!TYPES.has(type)) return { error: "Elige sencillos o dobles." };
  if (!dateISO) return { error: "Elige al menos un horario." };

  let items: CartItem[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "No pudimos leer la selección. Intenta de nuevo." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Elige al menos un horario." };
  }
  if (items.length > MAX_CART_ITEMS) {
    return { error: `Elige como máximo ${MAX_CART_ITEMS} horarios por reserva.` };
  }

  const supabase = await createClient();
  const courtIds = [...new Set(items.map((i) => i.courtId))];

  const [{ data: courts }, { data: club }, { data: policy }, { data: existing }] =
    await Promise.all([
      supabase.from("court").select("id, name, surface").eq("club_id", clubId).in("id", courtIds),
      supabase.from("club").select("timezone").eq("id", clubId).single(),
      supabase.from("booking_policy").select("*").eq("club_id", clubId).single(),
      supabase
        .from("booking")
        .select("court_id, starts_at, ends_at")
        .eq("club_id", clubId)
        .in("court_id", courtIds)
        .neq("status", "cancelled"),
    ]);

  if (!club || !policy) return { error: "No pudimos validar la reserva." };

  const courtById = new Map((courts ?? []).map((c) => [c.id, c]));
  const maxDate = new Date(new Date().getTime() + policy.max_advance_days * 86_400_000);

  let succeeded = 0;
  let unavailable = 0;

  for (const item of items) {
    const court = courtById.get(item.courtId);
    if (!court || new Date(item.startsAtUtc) > maxDate) {
      unavailable++;
      continue;
    }

    const validSlots = generateSlots({
      dateISO,
      timeZone: club.timezone,
      slotMinutes: policy.slot_minutes,
      minAdvanceHours: policy.min_advance_hours,
      now: new Date(),
      existingBookingsUtc: (existing ?? [])
        .filter((b) => b.court_id === item.courtId)
        .map((b) => ({ startsAtUtc: b.starts_at, endsAtUtc: b.ends_at })),
    });
    const chosen = validSlots.find(
      (s) => s.startsAtUtc === item.startsAtUtc && s.endsAtUtc === item.endsAtUtc,
    );
    if (!chosen) {
      unavailable++;
      continue;
    }

    const { error } = await supabase.from("booking").insert({
      club_id: clubId,
      court_id: item.courtId,
      person_id: userId,
      type,
      status: "confirmed",
      starts_at: item.startsAtUtc,
      ends_at: item.endsAtUtc,
    });
    if (error) {
      unavailable++;
      continue;
    }
    succeeded++;
  }

  revalidatePath("/student/book");

  if (succeeded === 0) {
    return { error: "Ninguno de esos horarios sigue disponible. Elige otros." };
  }
  const plural = succeeded > 1 ? "s" : "";
  if (unavailable > 0) {
    return {
      message: `${succeeded} de ${items.length} reserva${plural} confirmada${plural}. Las demás ya no estaban disponibles. Pendiente de pago en recepción.`,
    };
  }
  return {
    message: `${succeeded} reserva${plural} confirmada${plural}. Pendiente de pago en recepción.`,
  };
}
