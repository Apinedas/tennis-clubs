import Link from "next/link";
import { requireArea } from "@/lib/auth/dal";
import { selectApplicableRate } from "@/lib/rate-matching";
import { addDays, formatLocalTime, zonedTimeToUtcISO } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import { CancelReservationButton, ScheduleToolbar } from "./schedule-actions";

export const metadata = { title: "Calendario · Academia de Tenis" };

const GRID_START_MIN = 6 * 60; // 06:00
const GRID_END_MIN = 22 * 60; // 22:00

const SURFACE_LABELS: Record<string, string> = {
  clay: "Arcilla",
  hard: "Dura",
  grass: "Césped",
  carpet: "Sintética",
  other: "Otra",
};

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

const CELL_STYLE: Record<string, string> = {
  confirmed: "border-occupied-border bg-occupied-bg text-occupied-fg",
  pending: "border-blocked-border bg-blocked-bg text-blocked-fg border-dashed",
  blocked: "border-blocked-border bg-blocked-bg text-blocked-fg",
};

export default async function AdminSchedulePage({
  searchParams,
}: PageProps<"/admin/schedule">) {
  const session = await requireArea("admin");
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = typeof params.date === "string" && params.date ? params.date : today;
  const surfaceFilter = typeof params.surface === "string" ? params.surface : "";
  const selectedBookingId = typeof params.booking === "string" ? params.booking : "";
  // Prefill for the "Crear reserva" panel, set when a free grid cell is clicked.
  const prefillCourt = typeof params.court === "string" ? params.court : "";
  const prefillStart = typeof params.start === "string" ? params.start : "";

  const [{ data: club }, { data: allCourts }, { data: members }, { data: coaches }, { data: policy }, { data: rates }] =
    await Promise.all([
      supabase.from("club").select("timezone").eq("id", clubId).single(),
      supabase.from("court").select("*").eq("club_id", clubId).eq("active", true).order("name"),
      supabase.rpc("list_club_members", { p_club: clubId }),
      supabase.rpc("list_club_coaches", { p_club: clubId }),
      supabase.from("booking_policy").select("*").eq("club_id", clubId).single(),
      supabase
        .from("rate")
        .select("*")
        .eq("club_id", clubId)
        .eq("active", true)
        .or("category.eq.member,category.is.null"),
    ]);

  const timeZone = club?.timezone ?? "America/Bogota";
  const stepMin = policy?.slot_minutes ?? 60;
  const totalRows = Math.floor((GRID_END_MIN - GRID_START_MIN) / stepMin);
  const courts = (allCourts ?? []).filter((c) => !surfaceFilter || c.surface === surfaceFilter);
  const courtIndex = new Map(courts.map((c, i) => [c.id, i]));

  const rangeStart = zonedTimeToUtcISO(date, "00:00", timeZone);
  const rangeEnd = zonedTimeToUtcISO(addDays(date, 1), "00:00", timeZone);

  const { data: rawBookings } = await supabase
    .from("booking")
    .select("id,status,type,starts_at,ends_at,court_id,person_id,coach_id,guest_name,notes")
    .eq("club_id", clubId)
    .neq("status", "cancelled")
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd)
    .order("starts_at");

  const personIds = [
    ...new Set((rawBookings ?? []).flatMap((b) => [b.person_id, b.coach_id].filter(Boolean))),
  ] as string[];
  const { data: people } =
    personIds.length > 0
      ? await supabase.from("person").select("id, full_name").in("id", personIds)
      : { data: [] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const bookings = (rawBookings ?? []).filter((b) => courtIndex.has(b.court_id));

  function label(b: (typeof bookings)[number]) {
    if (b.status === "blocked") return b.notes || "Bloqueada";
    if (b.type === "lesson") {
      return `Clase · ${b.person_id ? (nameById.get(b.person_id) ?? "Alumno") : "Alumno"}`;
    }
    const who = b.person_id ? nameById.get(b.person_id) ?? "Socio" : (b.guest_name ?? "Invitado");
    return `${who} · ${b.type === "doubles" ? "Dobles" : "Sencillos"}`;
  }

  const rowLabels = Array.from({ length: totalRows }, (_, i) => toHHMM(GRID_START_MIN + i * stepMin));

  function withParams(overrides: Record<string, string | null>) {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    if (surfaceFilter) p.set("surface", surfaceFilter);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `?${p.toString()}`;
  }

  // One free-slot cell per court per row: same "does this overlap an
  // existing booking" question the self-service flows ask, but without the
  // min/max advance-hour rules — those exist to constrain self-service, not
  // staff at the desk.
  const freeCells = courts.flatMap((court) =>
    rowLabels.map((hhmm, row) => {
      const startMin = GRID_START_MIN + row * stepMin;
      if (startMin + stepMin > GRID_END_MIN) return null;
      const slotStart = new Date(zonedTimeToUtcISO(date, hhmm, timeZone));
      const slotEnd = new Date(zonedTimeToUtcISO(date, toHHMM(startMin + stepMin), timeZone));
      const overlaps = bookings.some(
        (b) =>
          b.court_id === court.id &&
          slotStart < new Date(b.ends_at) &&
          new Date(b.starts_at) < slotEnd,
      );
      if (overlaps) return null;
      const rate = selectApplicableRate(rates ?? [], {
        courtId: court.id,
        courtSurface: court.surface,
        service: "singles",
        startsAtUtc: slotStart.toISOString(),
        endsAtUtc: slotEnd.toISOString(),
        timeZone,
      });
      return { courtId: court.id, row, startTime: hhmm, endTime: toHHMM(startMin + stepMin), price: rate?.price_amount ?? null };
    }),
  ).filter((c) => c !== null);

  const selected = bookings.find((b) => b.id === selectedBookingId);
  let selectedPrice: number | null = null;
  let selectedCourt: (typeof courts)[number] | undefined;
  if (selected) {
    selectedCourt = courts.find((c) => c.id === selected.court_id);
    if (selectedCourt && selected.status !== "blocked") {
      const rate = selectApplicableRate(rates ?? [], {
        courtId: selectedCourt.id,
        courtSurface: selectedCourt.surface,
        service: selected.type ?? "singles",
        startsAtUtc: selected.starts_at,
        endsAtUtc: selected.ends_at,
        timeZone,
      });
      selectedPrice = rate?.price_amount ?? null;
    }
  }

  const confirmedToday = bookings.filter((b) => b.status === "confirmed").length;
  const blockedToday = bookings.filter((b) => b.status === "blocked").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Calendario Operativo</h1>
          <p className="text-body-md text-on-surface-variant">
            Todas las reservas del club, todas las canchas.
          </p>
        </div>

        <ScheduleToolbar
          // Remounts (and re-applies the initial* props) whenever a
          // different free cell is clicked; without this, clicking a
          // second cell while the panel is already open wouldn't update it.
          key={`${prefillCourt}-${prefillStart}`}
          courts={courts.map((c) => ({ id: c.id, name: c.name }))}
          members={(members ?? [])
            .filter((m) => m.active)
            .map((m) => ({ person_id: m.person_id, full_name: m.full_name }))}
          coaches={coaches ?? []}
          date={date}
          initialOpen={prefillCourt && prefillStart ? "create" : null}
          initialCourtId={prefillCourt}
          initialStartTime={prefillStart}
          initialEndTime={prefillStart ? toHHMM(toMinutes(prefillStart) + stepMin) : ""}
        />

        <div className="flex flex-wrap gap-3">
          <Stat label="Confirmadas hoy" value={confirmedToday} />
          <Stat label="Casillas libres" value={freeCells.length} />
          <Stat label="Bloqueos activos" value={blockedToday} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Link
              href={withParams({ date: addDays(date, -1) })}
              className="rounded-lg border border-border px-2.5 py-1 text-label-sm text-on-surface-variant hover:bg-surface-container"
              aria-label="Día anterior"
            >
              ←
            </Link>
            <span className="text-body-md-medium capitalize text-on-surface">
              {new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
            <Link
              href={withParams({ date: addDays(date, 1) })}
              className="rounded-lg border border-border px-2.5 py-1 text-label-sm text-on-surface-variant hover:bg-surface-container"
              aria-label="Día siguiente"
            >
              →
            </Link>
            <Link
              href={withParams({ date: today })}
              className={
                date === today
                  ? "rounded-lg bg-primary px-3 py-1 text-label-sm text-on-primary"
                  : "rounded-lg border border-border px-3 py-1 text-label-sm text-on-surface-variant hover:bg-surface-container"
              }
            >
              Hoy
            </Link>
          </div>
          {new Set((allCourts ?? []).map((c) => c.surface)).size > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-xs uppercase text-on-surface-variant">Superficie:</span>
              <Link href={withParams({ surface: null })} className={chipClass(!surfaceFilter)}>
                Todas
              </Link>
              {Object.entries(SURFACE_LABELS)
                .filter(([v]) => (allCourts ?? []).some((c) => c.surface === v))
                .map(([value, l]) => (
                  <Link key={value} href={withParams({ surface: value })} className={chipClass(surfaceFilter === value)}>
                    {l}
                  </Link>
                ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className={selected ? "lg:col-span-8" : "lg:col-span-12"}>
            {courts.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                No hay canchas que coincidan con el filtro.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-surface-container-lowest shadow-sm">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `64px repeat(${courts.length}, minmax(140px, 1fr))`,
                    gridTemplateRows: `auto repeat(${totalRows}, 40px)`,
                  }}
                >
                  <div className="sticky top-0 z-10 border-b border-r border-border bg-surface-container p-2 text-label-xs text-on-surface-variant" style={{ gridColumn: 1, gridRow: 1 }}>
                    Hora
                  </div>
                  {courts.map((c, i) => (
                    <div
                      key={c.id}
                      className="sticky top-0 z-10 border-b border-r border-border bg-surface-container p-2 text-label-sm text-on-surface"
                      style={{ gridColumn: i + 2, gridRow: 1 }}
                    >
                      {c.name}
                      <span className="block text-label-xs text-on-surface-variant">
                        {SURFACE_LABELS[c.surface]}
                        {c.covered ? " · Techada" : ""}
                      </span>
                    </div>
                  ))}

                  {rowLabels.map((l, i) => (
                    <div
                      key={i}
                      className="border-b border-r border-border px-2 text-label-xs text-on-surface-variant"
                      style={{ gridColumn: 1, gridRow: i + 2 }}
                    >
                      {l}
                    </div>
                  ))}

                  {freeCells.map((cell) => (
                    <Link
                      key={`${cell.courtId}-${cell.row}`}
                      href={withParams({ court: cell.courtId, start: cell.startTime, create: "1" })}
                      className="m-px flex items-center justify-center border-b border-r border-available-border bg-available-bg text-label-xs font-medium text-available-fg hover:brightness-95"
                      style={{ gridColumn: (courtIndex.get(cell.courtId) ?? 0) + 2, gridRow: cell.row + 2 }}
                      title={`Reservar ${cell.startTime}–${cell.endTime}`}
                    >
                      {cell.price != null ? `+ $${(cell.price / 1000).toFixed(0)}k` : "+"}
                    </Link>
                  ))}

                  {bookings.map((b) => {
                    const startLocal = toMinutes(formatLocalTime(b.starts_at, timeZone));
                    const endLocal = toMinutes(formatLocalTime(b.ends_at, timeZone));
                    const clampedStart = Math.max(startLocal, GRID_START_MIN);
                    const clampedEnd = Math.min(endLocal, GRID_END_MIN);
                    if (clampedEnd <= clampedStart) return null;
                    const startRow = Math.floor((clampedStart - GRID_START_MIN) / stepMin) + 2;
                    const rowSpan = Math.max(1, Math.ceil((clampedEnd - clampedStart) / stepMin));
                    return (
                      <Link
                        key={b.id}
                        href={withParams({ booking: b.id })}
                        className={`m-px overflow-hidden truncate rounded border px-1.5 py-0.5 text-label-xs ${CELL_STYLE[b.status]} ${b.id === selectedBookingId ? "ring-2 ring-primary" : ""}`}
                        style={{
                          gridColumn: (courtIndex.get(b.court_id) ?? 0) + 2,
                          gridRow: `${startRow} / span ${rowSpan}`,
                        }}
                        title={label(b)}
                      >
                        {label(b)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-3 text-label-xs text-on-surface-variant">
              <LegendDot className="bg-available-bg border-available-border" label="Disponible (clic para reservar)" />
              <LegendDot className="bg-occupied-bg border-occupied-border" label="Ocupada" />
              <LegendDot className="bg-blocked-bg border-blocked-border" label="Bloqueada / Pendiente" />
            </div>
          </div>

          {selected && (
            <div className="lg:col-span-4">
              <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-headline-sm text-on-surface">Detalle de la reserva</h2>
                  <Link href={withParams({ booking: null })} className="text-label-sm text-on-surface-variant hover:text-on-surface">
                    Cerrar
                  </Link>
                </div>
                <p className="text-body-md-medium text-on-surface">{label(selected)}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {new Date(selected.starts_at).toLocaleDateString("es-CO", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  · {formatLocalTime(selected.starts_at, timeZone)}–{formatLocalTime(selected.ends_at, timeZone)}
                  {selectedCourt && ` · ${selectedCourt.name}`}
                </p>
                {selected.notes && selected.status !== "blocked" && (
                  <p className="text-label-xs italic text-on-surface-variant">“{selected.notes}”</p>
                )}
                {selectedPrice != null && (
                  <p className="text-body-md text-on-surface">
                    Tarifa: <span className="text-body-md-medium">${selectedPrice.toLocaleString("es-CO")}</span>
                  </p>
                )}
                <p className="text-label-xs text-on-surface-variant">
                  Estado: {selected.status === "confirmed" ? "Confirmada" : selected.status === "pending" ? "Pendiente" : "Bloqueada"}
                </p>
                {(selected.status === "confirmed" || selected.status === "pending") && (
                  <CancelReservationButton bookingId={selected.id} />
                )}
              </section>
            </div>
          )}
        </div>
      </div>
  );
}

function chipClass(active: boolean) {
  return active
    ? "rounded-lg bg-primary px-2.5 py-1 text-label-xs text-on-primary"
    : "rounded-lg border border-border px-2.5 py-1 text-label-xs text-on-surface-variant hover:bg-surface-container";
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded border ${className}`} />
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface-container-lowest px-4 py-2">
      <span className="text-label-xs uppercase text-on-surface-variant">{label}</span>
      <span className="text-body-md-medium text-on-surface">{value}</span>
    </div>
  );
}
