import Link from "next/link";
import { requireArea } from "@/lib/auth/dal";
import { SURFACE_LABELS, WEEKDAYS } from "@/lib/labels";
import { addDays, isoWeekday, zonedTimeToUtcISO } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "./export-button";

export const metadata = { title: "Uso de canchas · Academia de Tenis" };

const OPERATING_HOURS_PER_DAY = 16; // 06:00–22:00, same window used everywhere else
const HOURS = Array.from({ length: OPERATING_HOURS_PER_DAY }, (_, i) => 6 + i);
const MAX_RANGE_DAYS = 366;

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
}

export default async function CourtUsageReportPage({
  searchParams,
}: PageProps<"/admin/reports/court-usage">) {
  const session = await requireArea("admin");
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const firstOfThisMonth = `${today.slice(0, 7)}-01`;
  const firstOfLastMonth = addDays(firstOfThisMonth, -1).slice(0, 7) + "-01";

  const from = typeof params.from === "string" && params.from ? params.from : addDays(today, -29);
  const requestedTo = typeof params.to === "string" && params.to ? params.to : today;
  const spanDays = daysBetween(from, requestedTo);
  const clamped = spanDays > MAX_RANGE_DAYS;
  const to = clamped ? addDays(from, MAX_RANGE_DAYS - 1) : requestedTo;
  const effectiveSpanDays = clamped ? MAX_RANGE_DAYS : spanDays;

  const { data: club } = await supabase.from("club").select("timezone").eq("id", clubId).single();
  const timeZone = club?.timezone ?? "America/Bogota";

  const rangeStart = zonedTimeToUtcISO(from, "00:00", timeZone);
  const rangeEnd = zonedTimeToUtcISO(addDays(to, 1), "00:00", timeZone);

  const [{ data: report }, { data: heatmap }, { count: activeCourts }] = await Promise.all([
    supabase.rpc("court_usage_report", { p_club: clubId, p_start: rangeStart, p_end: rangeEnd }),
    supabase.rpc("court_usage_heatmap", { p_club: clubId, p_start: rangeStart, p_end: rangeEnd }),
    supabase.from("court").select("*", { count: "exact", head: true }).eq("club_id", clubId).eq("active", true),
  ]);

  const courtsCount = activeCourts ?? 0;

  // How many times each ISO weekday (1..7) occurs in [from, to] — the
  // denominator for the heatmap's per-cell occupancy %.
  const weekdayOccurrences = new Map<number, number>();
  for (let i = 0; i < effectiveSpanDays; i++) {
    const wd = isoWeekday(addDays(from, i));
    weekdayOccurrences.set(wd, (weekdayOccurrences.get(wd) ?? 0) + 1);
  }

  const heatmapByCell = new Map((heatmap ?? []).map((h) => [`${h.weekday}-${h.hour}`, h.bookings_count]));
  function cellPct(weekday: number, hour: number) {
    const count = heatmapByCell.get(`${weekday}-${hour}`) ?? 0;
    const occurrences = weekdayOccurrences.get(weekday) ?? 0;
    if (occurrences === 0 || courtsCount === 0) return 0;
    return Math.min(100, (count / (occurrences * courtsCount)) * 100);
  }

  const rows = (report ?? []).map((r) => {
    const possibleHours = effectiveSpanDays * OPERATING_HOURS_PER_DAY;
    return {
      ...r,
      occupancyPct: possibleHours > 0 ? Math.min(100, (r.hours_reserved / possibleHours) * 100) : 0,
    };
  });

  const totalHours = rows.reduce((sum, r) => sum + r.hours_reserved, 0);
  const totalConfirmed = rows.reduce((sum, r) => sum + r.confirmed_count, 0);
  const totalCancelled = rows.reduce((sum, r) => sum + r.cancelled_count, 0);
  const totalPossibleHours = effectiveSpanDays * OPERATING_HOURS_PER_DAY * courtsCount;
  const overallOccupancy = totalPossibleHours > 0 ? (totalHours / totalPossibleHours) * 100 : 0;

  function withParams(overrides: Record<string, string>) {
    const p = new URLSearchParams({ from, to, ...overrides });
    return `?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Uso de Canchas</h1>
          <p className="text-body-md text-on-surface-variant">
            Ocupación agregada por cancha y horario. Solo lectura.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={withParams({ from: addDays(today, -29), to: today })} className={chipClass(from === addDays(today, -29) && to === today)}>
              Últimos 30 días
            </Link>
            <Link href={withParams({ from: firstOfThisMonth, to: today })} className={chipClass(from === firstOfThisMonth && to === today)}>
              Este mes
            </Link>
            <Link
              href={withParams({ from: firstOfLastMonth, to: addDays(firstOfThisMonth, -1) })}
              className={chipClass(from === firstOfLastMonth && to === addDays(firstOfThisMonth, -1))}
            >
              Mes anterior
            </Link>
            <form method="get" className="flex items-center gap-2">
              <input type="date" name="from" defaultValue={from} max={today} className="h-9 rounded-lg border border-border bg-surface-container-lowest px-2 text-label-sm text-on-surface" />
              <span className="text-label-sm text-on-surface-variant">a</span>
              <input type="date" name="to" defaultValue={to} max={today} className="h-9 rounded-lg border border-border bg-surface-container-lowest px-2 text-label-sm text-on-surface" />
              <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface hover:bg-surface-container">
                Ver
              </button>
            </form>
          </div>
          {clamped && (
            <p className="text-label-xs text-blocked-fg">
              El rango pedido supera un año; se limitó a {MAX_RANGE_DAYS} días desde {from}.
            </p>
          )}
          <p className="text-label-xs text-on-surface-variant">
            {from} a {to} · {effectiveSpanDays} días
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Stat label="Horas reservadas" value={`${totalHours.toFixed(1)} hrs`} />
          <Stat label="Ocupación global" value={`${overallOccupancy.toFixed(1)}%`} />
          <Stat label="Confirmadas" value={String(totalConfirmed)} />
          <Stat label="Canceladas" value={String(totalCancelled)} />
        </div>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-headline-sm text-on-surface">Mapa de calor: ocupación por franja horaria</h2>
            <p className="text-label-xs text-on-surface-variant">
              % de canchas ocupadas en cada bloque, promediado sobre el rango.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface-container-lowest shadow-sm">
            <table className="w-full min-w-[640px] border-collapse text-center">
              <thead>
                <tr>
                  <th className="border-b border-r border-border p-2 text-label-xs text-on-surface-variant">Hora</th>
                  {WEEKDAYS.map((d) => (
                    <th key={d.value} className="border-b border-border p-2 text-label-xs text-on-surface-variant">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="border-b border-r border-border p-2 text-label-xs text-on-surface-variant">
                      {String(hour).padStart(2, "0")}:00
                    </td>
                    {WEEKDAYS.map((d) => {
                      const pct = cellPct(d.value, hour);
                      return (
                        <td
                          key={d.value}
                          className="border-b border-border p-2 text-label-xs text-on-surface"
                          style={{ backgroundColor: `rgba(27, 127, 79, ${(pct / 100) * 0.85})` }}
                        >
                          {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-headline-sm text-on-surface">Desglose por cancha</h2>
              <p className="text-label-xs text-on-surface-variant">
                Horas reservadas y ocupación estimada sobre {OPERATING_HOURS_PER_DAY}h/día de operación.
              </p>
            </div>
            <ExportCsvButton rows={rows} from={from} to={to} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface-container-lowest shadow-sm">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-border text-label-sm text-on-surface-variant">
                  <th className="px-4 py-3 font-medium">Cancha</th>
                  <th className="px-4 py-3 font-medium">Horas reservadas</th>
                  <th className="px-4 py-3 font-medium">Ocupación</th>
                  <th className="px-4 py-3 font-medium">Confirmadas</th>
                  <th className="px-4 py-3 font-medium">Canceladas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.court_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-body-md-medium text-on-surface">{r.court_name}</p>
                      <p className="text-label-xs text-on-surface-variant">{SURFACE_LABELS[r.surface]}</p>
                    </td>
                    <td className="px-4 py-3 text-body-md text-on-surface">{r.hours_reserved.toFixed(1)} hrs</td>
                    <td className="px-4 py-3 text-body-md text-on-surface">{r.occupancyPct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-body-md text-on-surface">{r.confirmed_count}</td>
                    <td className="px-4 py-3 text-body-md text-on-surface">{r.cancelled_count}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-body-md text-on-surface-variant">
                      No hay canchas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
  );
}

function chipClass(active: boolean) {
  return active
    ? "rounded-lg bg-primary px-3 py-1.5 text-label-sm text-on-primary"
    : "rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface-variant hover:bg-surface-container";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface-container-lowest px-4 py-2">
      <span className="text-label-xs uppercase text-on-surface-variant">{label}</span>
      <span className="text-body-md-medium text-on-surface">{value}</span>
    </div>
  );
}
