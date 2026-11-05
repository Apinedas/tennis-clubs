"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./auth";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseCourseFields(formData: FormData) {
  const weekdays = formData
    .getAll("weekdays")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);

  return {
    fields: {
      court_id: text(formData, "court_id"),
      head_coach_id: text(formData, "head_coach_id"),
      assistant_coach_id: text(formData, "assistant_coach_id"),
      name: text(formData, "name"),
      level: text(formData, "level"),
      start_date: text(formData, "start_date"),
      end_date: text(formData, "end_date"),
      start_time: text(formData, "start_time"),
      end_time: text(formData, "end_time"),
      capacity: text(formData, "capacity"),
      rate_id: text(formData, "rate_id"),
      weekdays: weekdays.join(","),
    },
    weekdays,
  };
}

function validateCourseFields(
  fields: ReturnType<typeof parseCourseFields>["fields"],
  weekdays: number[],
) {
  if (fields.name.length < 2) return { error: "Ingresa el nombre del curso." };
  if (!fields.court_id) return { error: "Elige una cancha." };
  if (!fields.head_coach_id) return { error: "Elige un entrenador titular." };
  if (fields.assistant_coach_id && fields.assistant_coach_id === fields.head_coach_id) {
    return { error: "El asistente no puede ser el mismo titular." };
  }
  if (!DATE_RE.test(fields.start_date) || !DATE_RE.test(fields.end_date)) {
    return { error: "Ingresa fechas válidas." };
  }
  if (fields.start_date > fields.end_date) {
    return { error: "La fecha de fin debe ser posterior a la de inicio." };
  }
  if (!TIME_RE.test(fields.start_time) || !TIME_RE.test(fields.end_time)) {
    return { error: "Ingresa horas válidas (HH:MM)." };
  }
  if (fields.start_time >= fields.end_time) {
    return { error: "La hora de fin debe ser posterior a la de inicio." };
  }
  if (weekdays.length < 1) {
    return { error: "Elige al menos un día de entrenamiento." };
  }
  const capacity = Number(fields.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { error: "El cupo debe ser un número entero mayor a cero." };
  }
  return { capacity };
}

export async function createCourse(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const { fields, weekdays } = parseCourseFields(formData);

  const result = validateCourseFields(fields, weekdays);
  if ("error" in result) return { error: result.error, fields };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_course", {
    p_club: clubId,
    p_court_id: fields.court_id,
    p_head_coach_id: fields.head_coach_id,
    // Nullable uuid/text params with no SQL DEFAULT come back from the type
    // generator as plain `string`, not `string | null` — cast to match the
    // real (nullable) column types rather than the generator's blind spot.
    p_assistant_coach_id: (fields.assistant_coach_id || null) as string,
    p_name: fields.name,
    p_level: (fields.level || null) as string,
    p_start_date: fields.start_date,
    p_end_date: fields.end_date,
    p_weekdays: weekdays,
    p_start_time: fields.start_time,
    p_end_time: fields.end_time,
    p_capacity: result.capacity,
    p_rate_id: (fields.rate_id || null) as string,
  });

  if (error) {
    return {
      error: error.code === "23P01" ? error.message : "No pudimos crear el curso.",
      fields,
    };
  }

  revalidatePath("/admin/settings/courses");
  return { message: "Curso creado. Se generaron todas sus sesiones." };
}

// The scheduling fields (cancha, fechas, días, horas) are immutable once
// create_course() has generated sessions from them — only column-level
// granted here, matching the DB grant.
export async function updateCourse(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const courseId = text(formData, "course_id");
  if (!courseId) return { error: "Curso inválido." };

  const name = text(formData, "name");
  const level = text(formData, "level");
  const headCoachId = text(formData, "head_coach_id");
  const assistantCoachId = text(formData, "assistant_coach_id");
  const capacity = Number(text(formData, "capacity"));
  const rateId = text(formData, "rate_id");
  const fields = { name, level, head_coach_id: headCoachId, capacity: String(capacity) };

  if (name.length < 2) return { error: "Ingresa el nombre del curso.", fields };
  if (!headCoachId) return { error: "Elige un entrenador titular.", fields };
  if (assistantCoachId && assistantCoachId === headCoachId) {
    return { error: "El asistente no puede ser el mismo titular.", fields };
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { error: "El cupo debe ser un número entero mayor a cero.", fields };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("course")
    .update({
      name,
      level: level || null,
      head_coach_id: headCoachId,
      assistant_coach_id: assistantCoachId || null,
      capacity,
      rate_id: rateId || null,
    })
    .eq("id", courseId)
    .eq("club_id", clubId);

  if (error) return { error: "No pudimos guardar los cambios.", fields };

  revalidatePath("/admin/settings/courses");
  return { message: "Cambios guardados." };
}

export async function toggleCourseActive(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const courseId = text(formData, "course_id");
  const active = text(formData, "active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("course")
    .update({ active })
    .eq("id", courseId)
    .eq("club_id", clubId);

  if (error) return { error: "No pudimos cambiar el estado del curso." };

  revalidatePath("/admin/settings/courses");
  return undefined;
}

export async function enrollMember(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const courseId = text(formData, "course_id");
  const personId = text(formData, "person_id");
  if (!courseId || !personId) return { error: "Elige un socio." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("enroll_member", {
    p_course_id: courseId,
    p_person_id: personId,
  });
  if (error) {
    return {
      error: error.code === "23514" ? "El curso está lleno." : "No pudimos inscribir al socio.",
    };
  }

  revalidatePath("/admin/settings/courses");
  return { message: "Socio inscrito." };
}

export async function removeEnrollment(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const enrollmentId = text(formData, "enrollment_id");
  if (!enrollmentId) return { error: "Falta la inscripción." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_enrollment", { p_id: enrollmentId });
  if (error) return { error: "No pudimos retirar al socio." };

  revalidatePath("/admin/settings/courses");
  return { message: "Socio retirado." };
}

export async function reviewEnrollment(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const enrollmentId = text(formData, "enrollment_id");
  const approve = text(formData, "approve") === "true";
  const note = text(formData, "note");
  if (!enrollmentId) return { error: "Falta la inscripción." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_enrollment", {
    p_id: enrollmentId,
    p_approve: approve,
    p_note: note || undefined,
  });
  if (error) {
    return {
      error: error.code === "23514" ? "El curso está lleno." : "No pudimos procesar la solicitud.",
    };
  }

  revalidatePath("/admin/settings/courses");
  return { message: approve ? "Solicitud aprobada." : "Solicitud rechazada." };
}

export async function requestEnrollment(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("student");
  const courseId = text(formData, "course_id");
  const proofPath = text(formData, "payment_proof_path");
  if (!courseId) return { error: "Curso inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_enrollment", {
    p_course_id: courseId,
    p_payment_proof_path: (proofPath || null) as string,
  });
  if (error) {
    return {
      error:
        error.code === "23514"
          ? "Ese curso ya no tiene cupo."
          : error.code === "22023"
            ? "Este curso requiere comprobante de pago."
            : "No pudimos enviar tu solicitud.",
    };
  }

  revalidatePath("/student/courses");
  return { message: "Solicitud enviada. Te confirmamos cuando el club la revise." };
}

export async function requestUnenroll(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("student");
  const enrollmentId = text(formData, "enrollment_id");
  if (!enrollmentId) return { error: "Falta la inscripción." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_unenroll", { p_id: enrollmentId });
  if (error) return { error: "No pudimos enviar tu solicitud de baja." };

  revalidatePath("/student/courses");
  return { message: "Solicitud de baja enviada." };
}

export async function markAttendance(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("coach");
  const sessionId = text(formData, "session_booking_id");
  const personId = text(formData, "person_id");
  const present = text(formData, "present") === "true";
  if (!sessionId || !personId) return { error: "Datos incompletos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_attendance", {
    p_session_booking_id: sessionId,
    p_person_id: personId,
    p_present: present,
  });
  if (error) return { error: "No pudimos registrar la asistencia." };

  revalidatePath("/coach/courses");
  return undefined;
}
