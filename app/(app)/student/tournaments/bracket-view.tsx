import { computeStandings } from "@/lib/bracket";
import type { Database } from "@/lib/database.types";

type Entry = Database["public"]["Functions"]["list_tournament_entries"]["Returns"][number];
type Match = Database["public"]["Functions"]["list_tournament_matches"]["Returns"][number];

function MatchLine({ match }: { match: Match }) {
  const label1 = match.entry1_name ?? "Bye";
  const label2 = match.entry2_name ?? "Bye";
  return (
    <li className="flex flex-col gap-0.5 rounded-lg bg-surface-container px-3 py-2">
      <p className="text-body-md text-on-surface">
        {label1} <span className="text-on-surface-variant">vs</span> {label2}
      </p>
      <p className="text-label-xs text-on-surface-variant">
        {match.status === "completed"
          ? `Ganó ${match.winner_entry_id === match.entry1_id ? match.entry1_name : match.entry2_name}${match.score ? ` · ${match.score}` : ""}`
          : match.scheduled_at
            ? `${match.court_name} · ${new Date(match.scheduled_at).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
            : "Sin agendar"}
      </p>
    </li>
  );
}

export function BracketView({ entries, matches }: { entries: Entry[]; matches: Match[] }) {
  const groupMatches = matches.filter((m) => m.phase === "group");
  const knockoutMatches = matches.filter((m) => m.phase === "knockout");
  const groupLabels = [...new Set(entries.map((e) => e.group_label).filter((g): g is string => !!g))].sort();
  const rounds = [...new Set(knockoutMatches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4">
      {groupLabels.length > 0 && (
        <div className="flex flex-col gap-3">
          {groupLabels.map((label) => {
            const groupEntries = entries.filter((e) => e.group_label === label);
            const theseMatches = groupMatches.filter(
              (m) =>
                groupEntries.some((e) => e.id === m.entry1_id) || groupEntries.some((e) => e.id === m.entry2_id),
            );
            const standings = computeStandings(
              groupEntries.map((e) => ({ id: e.id, seed: e.seed })),
              theseMatches.map((m) => ({
                entry1Id: m.entry1_id as string,
                entry2Id: m.entry2_id as string,
                winnerEntryId: m.winner_entry_id,
              })),
            );
            const nameById = new Map(groupEntries.map((e) => [e.id, e.full_name]));

            return (
              <div key={label} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <p className="text-label-sm font-medium text-on-surface">Grupo {label}</p>
                <table className="w-full text-left text-label-sm">
                  <thead>
                    <tr className="text-on-surface-variant">
                      <th className="py-1 font-medium">Jugador</th>
                      <th className="py-1 font-medium">G</th>
                      <th className="py-1 font-medium">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s) => (
                      <tr key={s.entryId}>
                        <td className="py-1 text-on-surface">{nameById.get(s.entryId)}</td>
                        <td className="py-1 text-on-surface">{s.wins}</td>
                        <td className="py-1 text-on-surface">{s.losses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="flex flex-col gap-1.5">
                  {theseMatches.map((m) => (
                    <MatchLine key={m.id} match={m} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {knockoutMatches.length > 0 && (
        <div className="flex flex-col gap-3">
          {rounds.map((round) => (
            <div key={round} className="flex flex-col gap-2">
              <p className="text-label-sm font-medium text-on-surface">
                {round === rounds[rounds.length - 1] ? "Final" : `Ronda ${round}`}
              </p>
              <ul className="flex flex-col gap-1.5">
                {knockoutMatches
                  .filter((m) => m.round === round)
                  .map((m) => (
                    <MatchLine key={m.id} match={m} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
