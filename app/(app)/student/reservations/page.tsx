import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { getProfile, requireArea } from "@/lib/auth/dal";
import { formatLocalTime } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { CancelReservationButton } from "./reservation-actions";

export const metadata = { title: "Mis reservas · Academia de Tenis" };

type Status = Database["public"]["Enums"]["booking_status"];

type Reservation = {
  id: string;
  status: Status;
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
};

export default async function ReservationsPage({
  searchParams,
}: PageProps<"/student/reservations">) {
  const session = await requireArea("student");
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const tab = params.tab === "history" ? "history" : "upcoming";

  const [{ data: lessons }, { data: general }, { data: policy }, { data: club }] =
    await Promise.all([
      supabase.rpc("list_my_lessons", { p_club: clubId }),
      supabase
        .from("booking")
        .select("id, status, starts_at, ends_at, type, court:court(name)")
        .eq("club_id", clubId)
        .eq("person_id", session.userId)
        .in("type", ["singles", "doubles"]),
      supabase.from("booking_policy").select("*").eq("club_id", clubId).single(),
      supabase.from("club").select("timezone").eq("id", clubId).single(),
    ]);

  const timeZone = club?.timezone ?? "America/Bogota";

  const lessonRows: Reservation[] = (lessons ?? [])
    .filter((l) => l.viewer_role === "student")
    .map((l) => ({
      id: l.id,
      status: l.status,
      startsAt: l.starts_at,
      endsAt: l.ends_at,
      title: `Clase con ${l.counterpart_name}`,
      subtitle: l.court_name,
    }));

  const courtRows: Reservation[] = (general ?? []).map((b) => ({
    id: b.id,
    status: b.status,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    title: `${b.court?.name ?? "Cancha"} · ${b.type === "singles" ? "Sencillos" : "Dobles"}`,
    subtitle: "",
  }));

  const all = [...lessonRows, ...courtRows];
  const now = new Date();
  const isUpcoming = (r: Reservation) =>
    (r.status === "pending" || r.status === "confirmed") && new Date(r.startsAt) >= now;

  const upcoming = all.filter(isUpcoming).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const history = all
    .filter((r) => !isUpcoming(r))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const visible = tab === "upcoming" ? upcoming : history;

  return (
    <AppShell profile={profile} area="student">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Link href="/student" className="text-label-sm text-on-surface-variant hover:text-on-surface">
            ← Alumno
          </Link>
          <h1 className="text-headline-lg text-on-surface">Mis reservas</h1>
        </div>

        {policy && (
          <div className="rounded-lg border border-available-border bg-available-bg p-3 text-body-md text-available-fg">
            Cancelaciones sin recargo hasta {policy.cancellation_hours} horas antes del turno.
          </div>
        )}

        <div className="flex gap-2">
          <Link
            href="?tab=upcoming"
            className={
              tab === "upcoming"
                ? "rounded-lg bg-primary px-3 py-1.5 text-label-sm text-on-primary"
                : "rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface-variant hover:bg-surface-container"
            }
          >
            Próximas ({upcoming.length})
          </Link>
          <Link
            href="?tab=history"
            className={
              tab === "history"
                ? "rounded-lg bg-primary px-3 py-1.5 text-label-sm text-on-primary"
                : "rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface-variant hover:bg-surface-container"
            }
          >
            Historial ({history.length})
          </Link>
        </div>

        {visible.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">
            {tab === "upcoming" ? "No tienes reservas próximas." : "Todavía no hay historial."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((r) => {
              const lateForFreeCancel =
                policy != null &&
                new Date(r.startsAt).getTime() - now.getTime() < policy.cancellation_hours * 3_600_000;

              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-container-lowest p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-body-md-medium text-on-surface">{r.title}</p>
                      <LessonStatusBadge status={r.status} />
                    </div>
                    <p className="text-label-xs text-on-surface-variant">
                      {new Date(r.startsAt).toLocaleDateString("es-CO", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}{" "}
                      · {formatLocalTime(r.startsAt, timeZone)}–{formatLocalTime(r.endsAt, timeZone)}
                      {r.subtitle && ` · ${r.subtitle}`}
                    </p>
                  </div>
                  {tab === "upcoming" &&
                    (policy?.self_cancel_allowed ? (
                      <div className="flex flex-col items-end gap-1">
                        <CancelReservationButton bookingId={r.id} />
                        {lateForFreeCancel && (
                          <span className="max-w-[180px] text-right text-label-xs text-on-surface-variant">
                            Fuera del plazo de cancelación sin recargo
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-label-xs text-on-surface-variant">
                        El club gestiona las cancelaciones
                      </span>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
