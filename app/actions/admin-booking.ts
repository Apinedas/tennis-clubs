"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { zonedTimeToUtcISO } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { FormState } from "./auth";

type BookingType = Database["public"]["Enums"]["booking_type"];
const MATCH_TYPES = new Set<BookingType>(["singles", "doubles"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function timeRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  date: string,
  startTime: string,
  endTime: string,
) {
  const { data: club } = await supabase
    .from("club")
    .select("timezone")
    .eq("id", clubId)
    .single();
  if (!club) return null;
  return {
    startsAt: zonedTimeToUtcISO(date, startTime, club.timezone),
    endsAt: zonedTimeToUtcISO(date, endTime, club.timezone),
  };
}

// Admin bypasses the self-service rules entirely (see booking_insert): this
// covers all three shapes the schedule shows — a member's turn, a walk-in
// guest, or a class with a coach — created confirmed right away, no request
// step (that's only for a student's own self-service ask).
export async function createReservation(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;

  const kind = text(formData, "kind"); // member | guest | lesson
  const courtId = text(formData, "court_id");
  const date = text(formData, "date");
  const startTime = text(formData, "start_time");
  const endTime = text(formData, "end_time");
  const fields = { court_id: courtId, date, start_time: startTime, end_time: endTime };

  if (!courtId || !date || !startTime || !endTime) {
    return { error: "Completa cancha, fecha y horario.", fields };
  }
  if (startTime >= endTime) {
    return { error: "La hora de fin debe ser posterior a la de inicio.", fields };
  }

  const supabase = await createClient();
  const range = await timeRange(supabase, clubId, date, startTime, endTime);
  if (!range) return { error: "No pudimos validar el club.", fields };

  const row: Database["public"]["Tables"]["booking"]["Insert"] = {
    club_id: clubId,
    court_id: courtId,
    status: "confirmed",
    starts_at: range.startsAt,
    ends_at: range.endsAt,
    type: "singles",
  };

  if (kind === "member") {
    const personId = text(formData, "person_id");
    const type = text(formData, "type") as BookingType;
    if (!personId) return { error: "Elige un socio.", fields };
    if (!MATCH_TYPES.has(type)) return { error: "Elige sencillos o dobles.", fields };
    row.person_id = personId;
    row.type = type;
  } else if (kind === "guest") {
    const guestName = text(formData, "guest_name");
    const type = text(formData, "type") as BookingType;
    if (!guestName) return { error: "Ingresa el nombre del invitado.", fields };
    if (!MATCH_TYPES.has(type)) return { error: "Elige sencillos o dobles.", fields };
    row.guest_name = guestName;
    row.type = type;
  } else if (kind === "lesson") {
    const coachId = text(formData, "coach_id");
    const personId = text(formData, "person_id");
    if (!coachId || !personId) return { error: "Elige entrenador y alumno.", fields };
    row.coach_id = coachId;
    row.person_id = personId;
    row.type = "lesson";
  } else {
    return { error: "Elige el tipo de reserva.", fields };
  }

  const { error } = await supabase.from("booking").insert(row);
  if (error) {
    return {
      error:
        error.code === "23P01"
          ? "Esa cancha ya está ocupada en ese horario."
          : "No pudimos crear la reserva.",
      fields,
    };
  }

  revalidatePath("/admin/schedule");
  return { message: "Reserva creada." };
}

export async function blockCourt(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;

  const courtId = text(formData, "court_id");
  const date = text(formData, "date");
  const startTime = text(formData, "start_time");
  const endTime = text(formData, "end_time");
  const reason = text(formData, "reason").slice(0, 250);
  const fields = { court_id: courtId, date, start_time: startTime, end_time: endTime };

  if (!courtId || !date || !startTime || !endTime) {
    return { error: "Completa cancha, fecha y horario.", fields };
  }
  if (startTime >= endTime) {
    return { error: "La hora de fin debe ser posterior a la de inicio.", fields };
  }

  const supabase = await createClient();
  const range = await timeRange(supabase, clubId, date, startTime, endTime);
  if (!range) return { error: "No pudimos validar el club.", fields };

  const { error } = await supabase.from("booking").insert({
    club_id: clubId,
    court_id: courtId,
    status: "blocked",
    notes: reason || null,
    starts_at: range.startsAt,
    ends_at: range.endsAt,
  });

  if (error) {
    return {
      error:
        error.code === "23P01"
          ? "Esa cancha ya tiene algo agendado en ese horario."
          : "No pudimos bloquear la cancha.",
      fields,
    };
  }

  revalidatePath("/admin/schedule");
  return { message: "Cancha bloqueada." };
}

export async function cancelReservation(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const bookingId = text(formData, "booking_id");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_id: bookingId });
  if (error) return { error: "No pudimos cancelar la reserva." };

  revalidatePath("/admin/schedule");
  return undefined;
}
