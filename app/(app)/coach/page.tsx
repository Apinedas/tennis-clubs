import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { getProfile, requireArea, requireModuleEnabled } from "@/lib/auth/dal";
import { addDays, formatLocalTime, zonedTimeToUtcISO } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import { RespondButtons } from "./lesson-actions";

export const metadata = { title: "Agenda · Academia de Tenis" };

type AgendaItem = {
  id: string;
  status: "confirmed";
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
};

export default async function CoachPage({
  searchParams,
}: PageProps<"/coach">) {
  await requireArea("coach");
  const session = await requireModuleEnabled("lessons", { back: "/coach" });
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = typeof params.date === "string" && params.date ? params.date : today;

  const [{ data: club }, { data: lessons }, { data: ownBookings }] = await Promise.all([
    supabase.from("club").select("timezone").eq("id", clubId).single(),
    supabase.rpc("list_my_lessons", { p_club: clubId }),
    supabase
      .from("booking")
      .select("id, status, starts_at, ends_at, type, court:court(name)")
      .eq("club_id", clubId)
      .eq("person_id", session.userId)
      .in("type", ["singles", "doubles"]),
  ]);
  const timeZone = club?.timezone ?? "America/Bogota";

  const mine = (lessons ?? []).filter((l) => l.viewer_role === "coach");
  // Not date-filtered: a request needs a response regardless of which day
  // it's for.
  const pending = mine
    .filter((l) => l.status === "pending")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const rangeStart = zonedTimeToUtcISO(date, "00:00", timeZone);
  const rangeEnd = zonedTimeToUtcISO(addDays(date, 1), "00:00", timeZone);
  const inRange = (startsAt: string) => startsAt >= rangeStart && startsAt < rangeEnd;

  const lessonItems: AgendaItem[] = mine
    .filter((l) => l.status === "confirmed" && inRange(l.starts_at))
    .map((l) => ({
      id: l.id,
      status: "confirmed",
      startsAt: l.starts_at,
      endsAt: l.ends_at,
      title: `Clase con ${l.counterpart_name}`,
      subtitle: l.court_name,
    }));

  const ownItems: AgendaItem[] = (ownBookings ?? [])
    .filter((b) => b.status === "confirmed" && inRange(b.starts_at))
    .map((b) => ({
      id: b.id,
      status: "confirmed",
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      title: "Reserva personal",
      subtitle: `${b.court?.name ?? "Cancha"} · ${b.type === "singles" ? "Sencillos" : "Dobles"}`,
    }));

  const schedule = [...lessonItems, ...ownItems].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );

  const now = new Date();
  const isNow = (item: AgendaItem) =>
    now >= new Date(item.startsAt) && now < new Date(item.endsAt);

  const dateLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <AppShell profile={profile} area="coach">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg text-on-surface">Agenda</h1>
          <p className="text-body-md text-on-surface-variant">
            Solicitudes de clase y tu cronograma del día.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-headline-sm text-on-surface">
            Solicitudes por responder {pending.length > 0 && `(${pending.length})`}
          </h2>
          {pending.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              No tienes solicitudes pendientes.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blocked-border bg-blocked-bg/40 p-3"
                >
                  <div>
                    <p className="text-body-md-medium text-on-surface">
                      {l.counterpart_name}
                    </p>
                    <p className="text-label-xs text-on-surface-variant">
                      {new Date(l.starts_at).toLocaleDateString("es-CO", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}{" "}
                      · {formatLocalTime(l.starts_at, timeZone)}–
                      {formatLocalTime(l.ends_at, timeZone)} · {l.court_name}
                    </p>
                    {l.notes && (
                      <p className="mt-1 max-w-sm text-label-xs text-on-surface italic">
                        “{l.notes}”
                      </p>
                    )}
                  </div>
                  <RespondButtons bookingId={l.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-headline-sm text-on-surface capitalize">
              Cronograma · {dateLabel}
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href={`?date=${addDays(date, -1)}`}
                className="rounded-lg border border-border px-2.5 py-1 text-label-sm text-on-surface-variant hover:bg-surface-container"
                aria-label="Día anterior"
              >
                ←
              </Link>
              <Link
                href={`?date=${today}`}
                className={
                  date === today
                    ? "rounded-lg bg-primary px-3 py-1 text-label-sm text-on-primary"
                    : "rounded-lg border border-border px-3 py-1 text-label-sm text-on-surface-variant hover:bg-surface-container"
                }
              >
                Hoy
              </Link>
              <Link
                href={`?date=${addDays(date, 1)}`}
                className="rounded-lg border border-border px-2.5 py-1 text-label-sm text-on-surface-variant hover:bg-surface-container"
                aria-label="Día siguiente"
              >
                →
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-container-lowest px-4 py-2 text-body-md text-on-surface w-fit">
            Clases hoy: <span className="text-body-md-medium">{lessonItems.length}</span>
          </div>

          {schedule.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              No tienes nada agendado ese día.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {schedule.map((item) => (
                <li
                  key={item.id}
                  className={
                    "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 " +
                    (isNow(item)
                      ? "border-available-border bg-available-bg"
                      : "border-border bg-surface-container-lowest")
                  }
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-body-md-medium text-on-surface">{item.title}</p>
                      {isNow(item) ? (
                        <span className="rounded-md border border-available-border bg-available-bg px-2 py-0.5 text-label-xs text-available-fg">
                          En curso
                        </span>
                      ) : (
                        <LessonStatusBadge status={item.status} />
                      )}
                    </div>
                    <p className="text-label-xs text-on-surface-variant">
                      {formatLocalTime(item.startsAt, timeZone)}–
                      {formatLocalTime(item.endsAt, timeZone)} · {item.subtitle}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
