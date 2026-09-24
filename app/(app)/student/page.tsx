import { AppShell } from "@/components/app-shell";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { getProfile, requireArea, requireModuleEnabled } from "@/lib/auth/dal";
import { formatLocalTime, generateLessonSlots } from "@/lib/lesson-slots";
import { createClient } from "@/lib/supabase/server";
import { CancelLessonButton, RequestSlotButton } from "./lesson-actions";

export const metadata = { title: "Alumno · Academia de Tenis" };

export default async function StudentPage({
  searchParams,
}: PageProps<"/student">) {
  await requireArea("student");
  const session = await requireModuleEnabled("lessons", { back: "/student" });
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const coachId = typeof params.coach === "string" ? params.coach : "";
  const date = typeof params.date === "string" ? params.date : "";

  const [{ data: coaches }, { data: club }, { data: policy }, { data: lessons }] =
    await Promise.all([
      supabase.rpc("list_club_coaches", { p_club: clubId }),
      supabase.from("club").select("timezone").eq("id", clubId).single(),
      supabase.from("booking_policy").select("*").eq("club_id", clubId).single(),
      supabase.rpc("list_my_lessons", { p_club: clubId }),
    ]);

  const myLessons = (lessons ?? []).filter((l) => l.viewer_role === "student");

  let slots: { startsAtUtc: string; endsAtUtc: string; label: string }[] = [];
  if (coachId && date && club && policy) {
    const { data: existing } = await supabase
      .from("booking")
      .select("starts_at, ends_at")
      .eq("club_id", clubId)
      .eq("coach_id", coachId)
      .neq("status", "cancelled");

    slots = generateLessonSlots({
      dateISO: date,
      timeZone: club.timezone,
      slotMinutes: policy.slot_minutes,
      minAdvanceHours: policy.min_advance_hours,
      now: new Date(),
      existingBookingsUtc: (existing ?? []).map((b) => ({
        startsAtUtc: b.starts_at,
        endsAtUtc: b.ends_at,
      })),
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const maxDate = policy
    ? new Date(new Date().getTime() + policy.max_advance_days * 86_400_000)
        .toISOString()
        .slice(0, 10)
    : undefined;

  return (
    <AppShell profile={profile} area="student">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg text-on-surface">Solicitar clase</h1>
          <p className="text-body-md text-on-surface-variant">
            Elige un entrenador y un horario. El entrenador confirma tu solicitud.
          </p>
        </div>

        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="coach" className="text-label-sm text-on-surface-variant">
              Entrenador
            </label>
            <select
              id="coach"
              name="coach"
              defaultValue={coachId}
              className="h-10 rounded-lg border border-border bg-surface-container-lowest px-3 text-body-md text-on-surface"
            >
              <option value="" disabled>
                Elige un entrenador
              </option>
              {(coaches ?? []).map((c) => (
                <option key={c.person_id} value={c.person_id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="date" className="text-label-sm text-on-surface-variant">
              Día
            </label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={date}
              min={today}
              max={maxDate}
              className="h-10 rounded-lg border border-border bg-surface-container-lowest px-3 text-body-md text-on-surface"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-lg bg-primary px-4 text-body-md-medium text-on-primary hover:bg-primary-hover"
          >
            Ver horarios
          </button>
        </form>

        {coachId && date && (
          <section className="flex flex-col gap-3">
            <h2 className="text-headline-sm text-on-surface">
              Horarios disponibles
            </h2>
            {slots.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                No hay horarios libres ese día. Prueba con otra fecha.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <RequestSlotButton
                    key={slot.startsAtUtc}
                    coachId={coachId}
                    date={date}
                    startsAtUtc={slot.startsAtUtc}
                    endsAtUtc={slot.endsAtUtc}
                    label={formatLocalTime(slot.startsAtUtc, club?.timezone ?? "America/Bogota")}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-headline-sm text-on-surface">Mis clases</h2>
          {myLessons.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              Todavía no tienes clases solicitadas.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {myLessons.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-container-lowest p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-body-md-medium text-on-surface">
                        {l.counterpart_name}
                      </p>
                      <LessonStatusBadge status={l.status} />
                    </div>
                    <p className="text-label-xs text-on-surface-variant">
                      {new Date(l.starts_at).toLocaleDateString("es-CO", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}{" "}
                      · {formatLocalTime(l.starts_at, club?.timezone ?? "America/Bogota")}–
                      {formatLocalTime(l.ends_at, club?.timezone ?? "America/Bogota")} ·{" "}
                      {l.court_name}
                    </p>
                  </div>
                  {(l.status === "pending" || l.status === "confirmed") && (
                    <CancelLessonButton bookingId={l.id} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
