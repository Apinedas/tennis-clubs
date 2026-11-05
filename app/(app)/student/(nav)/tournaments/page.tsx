import Link from "next/link";
import { requireArea, requireModuleEnabled } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TournamentCard } from "./tournament-card";
import { BracketView } from "./bracket-view";

export const metadata = { title: "Torneos · Academia de Tenis" };

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Eliminación directa",
  round_robin: "Round robin",
  group_knockout: "Grupos + eliminatoria",
};

export default async function StudentTournamentsPage({
  searchParams,
}: PageProps<"/student/tournaments">) {
  await requireArea("student");
  const session = await requireModuleEnabled("tournaments", { back: "/student" });
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const selectedId = typeof params.tournament === "string" ? params.tournament : "";

  const [{ data: tournaments }, { data: myEntries }, { data: club }] = await Promise.all([
    supabase.rpc("list_club_tournaments", { p_club: clubId }),
    supabase
      .from("tournament_entry")
      .select("id, tournament_id, status, payment_rejection_note")
      .eq("person_id", session.userId)
      .neq("status", "cancelled"),
    supabase.from("club").select("currency").eq("id", clubId).single(),
  ]);
  const myEntryByTournament = new Map((myEntries ?? []).map((e) => [e.tournament_id, e]));
  const currency = club?.currency ?? "COP";

  const [{ data: entries }, { data: matches }] = selectedId
    ? await Promise.all([
        supabase.rpc("list_tournament_entries", { p_tournament_id: selectedId }),
        supabase.rpc("list_tournament_matches", { p_tournament_id: selectedId }),
      ])
    : [{ data: null }, { data: null }];

  const selected = (tournaments ?? []).find((t) => t.id === selectedId);
  const active = (tournaments ?? []).filter((t) => t.active);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Torneos</h1>
        <p className="text-body-md text-on-surface-variant">
          Inscríbete y sigue el cuadro.
        </p>
      </div>

      {active.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No hay torneos activos por ahora.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {active.map((t) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              formatLabel={FORMAT_LABELS[t.format] ?? t.format}
              myEntry={myEntryByTournament.get(t.id) ?? null}
              clubId={clubId}
              personId={session.userId}
              currency={currency}
            />
          ))}
        </div>
      )}

      {selected && (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm text-on-surface">{selected.name}</h2>
            <Link href="?" className="text-label-sm text-on-surface-variant hover:text-on-surface">
              Cerrar
            </Link>
          </div>
          {!selected.bracket_generated ? (
            <p className="text-body-md text-on-surface-variant">
              El cuadro todavía no se ha generado.
            </p>
          ) : (
            <BracketView entries={entries ?? []} matches={matches ?? []} />
          )}
        </section>
      )}
    </div>
  );
}
