import { AppShell } from "@/components/app-shell";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { getProfile, requireArea, requireModuleEnabled } from "@/lib/auth/dal";
import { formatLocalTime } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import { RespondButtons } from "./lesson-actions";

export const metadata = { title: "Entrenador · Academia de Tenis" };

export default async function CoachPage() {
  await requireArea("coach");
  const session = await requireModuleEnabled("lessons", { back: "/coach" });
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const [{ data: club }, { data: lessons }] = await Promise.all([
    supabase.from("club").select("timezone").eq("id", clubId).single(),
    supabase.rpc("list_my_lessons", { p_club: clubId }),
  ]);
  const timeZone = club?.timezone ?? "America/Bogota";

  const mine = (lessons ?? []).filter((l) => l.viewer_role === "coach");
  const pending = mine.filter((l) => l.status === "pending");
  const upcoming = mine
    .filter((l) => l.status === "confirmed")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <AppShell profile={profile} area="coach">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg text-on-surface">Agenda</h1>
          <p className="text-body-md text-on-surface-variant">
            Solicitudes de clase y tu cronograma confirmado.
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
                  </div>
                  <RespondButtons bookingId={l.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-headline-sm text-on-surface">Próximas clases</h2>
          {upcoming.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              No tienes clases confirmadas todavía.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((l) => (
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
                      · {formatLocalTime(l.starts_at, timeZone)}–
                      {formatLocalTime(l.ends_at, timeZone)} · {l.court_name}
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
