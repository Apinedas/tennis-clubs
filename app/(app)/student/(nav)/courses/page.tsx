import { requireArea, requireModuleEnabled } from "@/lib/auth/dal";
import { WEEKDAYS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { CourseActions } from "./course-actions";

export const metadata = { title: "Cursos · Academia de Tenis" };

function weekdaysLabel(weekdays: number[]) {
  if (weekdays.length === 7) return "Todos los días";
  return WEEKDAYS.filter((d) => weekdays.includes(d.value)).map((d) => d.label).join(", ");
}

export default async function StudentCoursesPage() {
  await requireArea("student");
  const session = await requireModuleEnabled("courses", { back: "/student" });
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const [{ data: courses }, { data: club }, { data: myEnrollments }] = await Promise.all([
    supabase.rpc("list_club_courses", { p_club: clubId }),
    supabase.from("club").select("currency").eq("id", clubId).single(),
    supabase
      .from("course_enrollment")
      .select("id, course_id, status, review_note")
      .eq("person_id", session.userId)
      .neq("status", "cancelled"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const currency = club?.currency ?? "COP";
  const enrollmentByCourse = new Map((myEnrollments ?? []).map((e) => [e.course_id, e]));
  const available = (courses ?? []).filter((c) => c.active && c.end_date >= today);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Academia &amp; Cursos</h1>
        <p className="text-body-md text-on-surface-variant">
          Clases grupales con cupo, por semanas.
        </p>
      </div>

      {available.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          No hay cursos abiertos por ahora.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {available.map((c) => {
            const spotsLeft = c.capacity - c.enrolled_count;
            const enrollment = enrollmentByCourse.get(c.id);
            return (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm"
              >
                <div>
                  <h3 className="text-headline-sm font-bold text-on-surface">{c.name}</h3>
                  <p className="text-label-xs text-on-surface-variant">
                    {c.level ? `${c.level} · ` : ""}
                    {c.head_coach_name}
                  </p>
                </div>
                <p className="text-body-md text-on-surface">
                  {weekdaysLabel(c.weekdays)} · {c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}
                </p>
                <p className="text-label-xs text-on-surface-variant">
                  {c.court_name} · desde{" "}
                  {new Date(`${c.start_date}T12:00:00Z`).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  hasta{" "}
                  {new Date(`${c.end_date}T12:00:00Z`).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  {spotsLeft > 0 ? `${spotsLeft} cupos disponibles` : "Sin cupo"}
                </p>
                <CourseActions
                  courseId={c.id}
                  price={c.price_amount}
                  currency={currency}
                  spotsLeft={spotsLeft}
                  enrollment={enrollment ?? null}
                  clubId={clubId}
                  personId={session.userId}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
