import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getProfile, requireArea, requireModuleEnabled } from "@/lib/auth/dal";
import { formatLocalTime } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import { AttendanceRoster } from "./attendance-roster";

export const metadata = { title: "Mis Cursos · Academia de Tenis" };

export default async function CoachCoursesPage({
  searchParams,
}: PageProps<"/coach/courses">) {
  await requireArea("coach");
  const session = await requireModuleEnabled("courses", { back: "/coach" });
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const selectedCourse = typeof params.course === "string" ? params.course : "";
  const selectedSession = typeof params.session === "string" ? params.session : "";

  const [{ data: club }, { data: courses }] = await Promise.all([
    supabase.from("club").select("timezone").eq("id", clubId).single(),
    supabase
      .from("course")
      .select("id, name, level, active")
      .eq("club_id", clubId)
      .or(`head_coach_id.eq.${session.userId},assistant_coach_id.eq.${session.userId}`)
      .order("name"),
  ]);
  const timeZone = club?.timezone ?? "America/Bogota";

  const coursesWithSessions = await Promise.all(
    (courses ?? []).map(async (c) => {
      const { data: sessions } = await supabase.rpc("list_course_sessions", { p_course_id: c.id });
      return { ...c, sessions: sessions ?? [] };
    }),
  );

  const { data: roster } = selectedCourse
    ? await supabase.rpc("list_course_roster", { p_course_id: selectedCourse })
    : { data: null };
  const { data: attendance } = selectedSession
    ? await supabase.from("course_attendance").select("person_id, present").eq("session_booking_id", selectedSession)
    : { data: null };
  const attendanceByPerson = new Map((attendance ?? []).map((a) => [a.person_id, a.present]));

  return (
    <AppShell profile={profile} area="coach">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Link href="/coach" className="text-label-sm text-on-surface-variant hover:text-on-surface">
            ← Agenda
          </Link>
          <h1 className="text-headline-lg text-on-surface">Mis Cursos</h1>
          <p className="text-body-md text-on-surface-variant">
            Cursos que dictas y pase de lista por sesión.
          </p>
        </div>

        {coursesWithSessions.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">
            No tienes cursos asignados.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {coursesWithSessions.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm"
              >
                <div>
                  <p className="text-body-md-medium text-on-surface">{c.name}</p>
                  {c.level && <p className="text-label-xs text-on-surface-variant">{c.level}</p>}
                </div>
                {c.sessions.length === 0 ? (
                  <p className="text-label-xs text-on-surface-variant">Sin sesiones programadas.</p>
                ) : (
                  <form className="flex flex-wrap items-center gap-2" action="/coach/courses">
                    <input type="hidden" name="course" value={c.id} />
                    <select
                      name="session"
                      defaultValue={c.id === selectedCourse ? selectedSession : ""}
                      className="h-9 rounded-lg border border-border bg-surface-container-lowest px-2 text-label-sm text-on-surface"
                    >
                      {c.sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {new Date(s.starts_at).toLocaleDateString("es-CO", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}{" "}
                          · {formatLocalTime(s.starts_at, timeZone)}
                          {s.status === "cancelled" ? " (cancelada)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface hover:bg-surface-container"
                    >
                      Pase de lista rápido
                    </button>
                  </form>
                )}

                {c.id === selectedCourse && selectedSession && (
                  <AttendanceRoster
                    sessionId={selectedSession}
                    roster={(roster ?? []).filter((r) => r.status === "active")}
                    attendanceByPerson={Object.fromEntries(attendanceByPerson)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
