import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getProfile, requireArea, requireModuleEnabled } from "@/lib/auth/dal";
import { formatLocalTime, generateSlots } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import { RequestSlotButton } from "./lesson-actions";

export const metadata = { title: "Clases · Academia de Tenis" };

export default async function StudentLessonsPage({
  searchParams,
}: PageProps<"/student/lessons">) {
  await requireArea("student");
  const session = await requireModuleEnabled("lessons", { back: "/student" });
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const coachId = typeof params.coach === "string" ? params.coach : "";
  const date = typeof params.date === "string" ? params.date : "";

  const [{ data: coaches }, { data: club }, { data: policy }] = await Promise.all([
    supabase.rpc("list_club_coaches", { p_club: clubId }),
    supabase.from("club").select("timezone").eq("id", clubId).single(),
    supabase.from("booking_policy").select("*").eq("club_id", clubId).single(),
  ]);

  let slots: { startsAtUtc: string; endsAtUtc: string; label: string }[] = [];
  if (coachId && date && club && policy) {
    const { data: existing } = await supabase
      .from("booking")
      .select("starts_at, ends_at")
      .eq("club_id", clubId)
      .eq("coach_id", coachId)
      .neq("status", "cancelled");

    slots = generateSlots({
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
          <Link href="/student" className="text-label-sm text-on-surface-variant hover:text-on-surface">
            ← Alumno
          </Link>
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

        <Link
          href="/student/reservations"
          className="text-body-md text-primary hover:underline"
        >
          Ver mis clases y reservas →
        </Link>
      </div>
    </AppShell>
  );
}
