import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { getProfile, requireArea, requireModuleEnabled } from "@/lib/auth/dal";
import { formatLocalTime, generateSlots, zonedTimeToUtcISO } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import { BookingGrid, CancelBookingButton } from "./booking-actions";

export const metadata = { title: "Reservar cancha · Academia de Tenis" };

const SURFACE_LABELS: Record<string, string> = {
  clay: "Arcilla",
  hard: "Dura",
  grass: "Césped",
  carpet: "Sintética",
  other: "Otra",
};

function addDays(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function BookCourtPage({
  searchParams,
}: PageProps<"/student/book">) {
  await requireArea("student");
  const session = await requireModuleEnabled("bookings", { back: "/student" });
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = typeof params.date === "string" ? params.date : today;
  const surfaceFilter = typeof params.surface === "string" ? params.surface : "";
  const coveredFilter = params.covered === "true" ? true : params.covered === "false" ? false : null;

  const [{ data: club }, { data: policy }, { data: allCourts }] = await Promise.all([
    supabase.from("club").select("timezone").eq("id", clubId).single(),
    supabase.from("booking_policy").select("*").eq("club_id", clubId).single(),
    supabase.from("court").select("*").eq("club_id", clubId).eq("active", true).order("name"),
  ]);

  const timeZone = club?.timezone ?? "America/Bogota";
  const courts = (allCourts ?? []).filter(
    (c) =>
      (!surfaceFilter || c.surface === surfaceFilter) &&
      (coveredFilter === null || c.covered === coveredFilter),
  );

  let courtsWithSlots: { id: string; name: string; surface: string; covered: boolean; slots: ReturnType<typeof generateSlots> }[] = [];
  if (club && policy && courts.length > 0) {
    const rangeStart = zonedTimeToUtcISO(date, "00:00", timeZone);
    const rangeEnd = zonedTimeToUtcISO(addDays(date, 1), "00:00", timeZone);
    const { data: existing } = await supabase
      .from("booking")
      .select("court_id, starts_at, ends_at")
      .eq("club_id", clubId)
      .in("court_id", courts.map((c) => c.id))
      .neq("status", "cancelled")
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd);

    courtsWithSlots = courts.map((court) => ({
      id: court.id,
      name: court.name,
      surface: court.surface,
      covered: court.covered,
      slots: generateSlots({
        dateISO: date,
        timeZone,
        slotMinutes: policy.slot_minutes,
        minAdvanceHours: policy.min_advance_hours,
        now: new Date(),
        existingBookingsUtc: (existing ?? [])
          .filter((b) => b.court_id === court.id)
          .map((b) => ({ startsAtUtc: b.starts_at, endsAtUtc: b.ends_at })),
      }),
    }));
  }

  const maxDate = policy
    ? new Date(new Date().getTime() + policy.max_advance_days * 86_400_000)
        .toISOString()
        .slice(0, 10)
    : undefined;

  const { data: myBookings } = await supabase
    .from("booking")
    .select("id, status, starts_at, ends_at, type, court:court(name)")
    .eq("club_id", clubId)
    .eq("person_id", session.userId)
    .in("type", ["singles", "doubles"])
    .order("starts_at", { ascending: false });

  const dayChips = Array.from({ length: 5 }, (_, i) => addDays(today, i));
  function withParams(overrides: Record<string, string | null>) {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    if (surfaceFilter) p.set("surface", surfaceFilter);
    if (coveredFilter !== null) p.set("covered", String(coveredFilter));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `?${p.toString()}`;
  }

  return (
    <AppShell profile={profile} area="student">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Link href="/student" className="text-label-sm text-on-surface-variant hover:text-on-surface">
            ← Alumno
          </Link>
          <h1 className="text-headline-lg text-on-surface">Reservar cancha</h1>
          <p className="text-body-md text-on-surface-variant">
            Elige un día, filtra si quieres, y toca un horario libre.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {dayChips.map((d, i) => (
              <Link
                key={d}
                href={withParams({ date: d })}
                className={
                  d === date
                    ? "rounded-lg bg-primary px-3 py-1.5 text-label-sm text-on-primary"
                    : "rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface-variant hover:bg-surface-container"
                }
              >
                {i === 0 ? "Hoy" : i === 1 ? "Mañana" : d.slice(5)}
              </Link>
            ))}
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="surface" value={surfaceFilter} />
              {coveredFilter !== null && (
                <input type="hidden" name="covered" value={String(coveredFilter)} />
              )}
              <input
                type="date"
                name="date"
                defaultValue={date}
                min={today}
                max={maxDate}
                className="h-9 rounded-lg border border-border bg-surface-container-lowest px-2 text-label-sm text-on-surface"
              />
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface hover:bg-surface-container"
              >
                Ir
              </button>
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-xs uppercase text-on-surface-variant">Superficie:</span>
            <Link href={withParams({ surface: null })} className={chipClass(!surfaceFilter)}>
              Todas
            </Link>
            {Object.entries(SURFACE_LABELS).map(([value, label]) => (
              <Link key={value} href={withParams({ surface: value })} className={chipClass(surfaceFilter === value)}>
                {label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-xs uppercase text-on-surface-variant">Cubierta:</span>
            <Link href={withParams({ covered: null })} className={chipClass(coveredFilter === null)}>
              Todas
            </Link>
            <Link href={withParams({ covered: "true" })} className={chipClass(coveredFilter === true)}>
              Techada
            </Link>
            <Link href={withParams({ covered: "false" })} className={chipClass(coveredFilter === false)}>
              Descubierta
            </Link>
          </div>
        </div>

        {courtsWithSlots.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">
            No hay canchas que coincidan con el filtro.
          </p>
        ) : (
          <BookingGrid courts={courtsWithSlots} date={date} timeZone={timeZone} />
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-headline-sm text-on-surface">Mis reservas</h2>
          {!myBookings || myBookings.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              Todavía no tienes reservas de cancha.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {myBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-container-lowest p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-body-md-medium text-on-surface">
                        {b.court?.name} · {b.type === "singles" ? "Sencillos" : "Dobles"}
                      </p>
                      <LessonStatusBadge status={b.status} />
                    </div>
                    <p className="text-label-xs text-on-surface-variant">
                      {new Date(b.starts_at).toLocaleDateString("es-CO", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}{" "}
                      · {formatLocalTime(b.starts_at, timeZone)}–{formatLocalTime(b.ends_at, timeZone)}
                    </p>
                  </div>
                  {b.status === "confirmed" &&
                    (policy?.self_cancel_allowed ? (
                      <div className="flex flex-col items-end gap-1">
                        <CancelBookingButton bookingId={b.id} />
                        {policy &&
                          new Date(b.starts_at).getTime() - new Date().getTime() <
                            policy.cancellation_hours * 3_600_000 && (
                            <span className="max-w-[160px] text-right text-label-xs text-on-surface-variant">
                              Fuera del plazo de cancelación ({policy.cancellation_hours}h antes)
                            </span>
                          )}
                      </div>
                    ) : (
                      <span className="text-label-xs text-on-surface-variant">
                        El club gestiona las cancelaciones
                      </span>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function chipClass(active: boolean) {
  return active
    ? "rounded-lg bg-primary px-2.5 py-1 text-label-xs text-on-primary"
    : "rounded-lg border border-border px-2.5 py-1 text-label-xs text-on-surface-variant hover:bg-surface-container";
}
