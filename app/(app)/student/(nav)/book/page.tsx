import Link from "next/link";
import { requireArea, requireModuleEnabled } from "@/lib/auth/dal";
import { addDays, generateSlots, todayInZone, zonedTimeToUtcISO } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import { BookingGrid } from "./booking-actions";

export const metadata = { title: "Reservar cancha · Academia de Tenis" };

const SURFACE_LABELS: Record<string, string> = {
  clay: "Arcilla",
  hard: "Dura",
  grass: "Césped",
  carpet: "Sintética",
  other: "Otra",
};

export default async function BookCourtPage({
  searchParams,
}: PageProps<"/student/book">) {
  await requireArea("student");
  const session = await requireModuleEnabled("bookings", { back: "/student" });
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  // Fetched first (not in the Promise.all below) because today/date depend
  // on it: "today" must be the club's calendar date, not the server
  // process's UTC date — new Date().toISOString() disagrees with it for
  // part of every day.
  const { data: club } = await supabase.from("club").select("timezone").eq("id", clubId).single();
  const timeZone = club?.timezone ?? "America/Bogota";
  const today = todayInZone(timeZone);

  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : today;
  const surfaceFilter = typeof params.surface === "string" ? params.surface : "";
  const coveredFilter = params.covered === "true" ? true : params.covered === "false" ? false : null;

  const [{ data: policy }, { data: allCourts }] = await Promise.all([
    supabase.from("booking_policy").select("*").eq("club_id", clubId).single(),
    supabase.from("court").select("*").eq("club_id", clubId).eq("active", true).order("name"),
  ]);

  const surfaces = new Set<string>((allCourts ?? []).map((c) => c.surface));
  const coveredValues = new Set((allCourts ?? []).map((c) => c.covered));
  const courts = (allCourts ?? []).filter(
    (c) =>
      (!surfaceFilter || c.surface === surfaceFilter) &&
      (coveredFilter === null || c.covered === coveredFilter),
  );

  let courtsWithSlots: { id: string; name: string; surface: string; covered: boolean; slots: ReturnType<typeof generateSlots> }[] = [];
  if (club && policy && courts.length > 0) {
    const rangeStart = zonedTimeToUtcISO(date, "00:00", timeZone);
    const rangeEnd = zonedTimeToUtcISO(addDays(date, 1), "00:00", timeZone);
    // RLS on booking only lets a member see their own rows — this RPC
    // returns just the occupied windows (no person_id) so the grid can
    // show what's actually free, not just what the viewer booked.
    const { data: existing } = await supabase.rpc("list_occupied_windows", {
      p_club: clubId,
      p_start: rangeStart,
      p_end: rangeEnd,
      p_court_ids: courts.map((c) => c.id),
    });

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

  const maxDate = policy ? addDays(today, policy.max_advance_days) : undefined;

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
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
              key={date}
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

        {surfaces.size > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-xs uppercase text-on-surface-variant">Superficie:</span>
            <Link href={withParams({ surface: null })} className={chipClass(!surfaceFilter)}>
              Todas
            </Link>
            {Object.entries(SURFACE_LABELS)
              .filter(([value]) => surfaces.has(value))
              .map(([value, label]) => (
                <Link key={value} href={withParams({ surface: value })} className={chipClass(surfaceFilter === value)}>
                  {label}
                </Link>
              ))}
          </div>
        )}
        {coveredValues.size > 1 && (
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
        )}
      </div>

      {courtsWithSlots.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          No hay canchas que coincidan con el filtro.
        </p>
      ) : (
        <BookingGrid key={date} courts={courtsWithSlots} date={date} timeZone={timeZone} />
      )}

      <Link href="/student/reservations" className="text-body-md text-primary hover:underline">
        Ver mis clases y reservas →
      </Link>
    </div>
  );
}

function chipClass(active: boolean) {
  return active
    ? "rounded-lg bg-primary px-2.5 py-1 text-label-xs text-on-primary"
    : "rounded-lg border border-border px-2.5 py-1 text-label-xs text-on-surface-variant hover:bg-surface-container";
}
