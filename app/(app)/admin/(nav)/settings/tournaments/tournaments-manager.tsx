"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  createTournament,
  generateBracket,
  generateKnockoutPhase,
  registerEntry,
  reportMatchResult,
  reviewEntry,
  scheduleMatch,
  toggleRegistration,
  withdrawEntry,
} from "@/app/actions/tournaments";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { computeStandings } from "@/lib/bracket";
import { formatMoney } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type Tournament = Database["public"]["Functions"]["list_club_tournaments"]["Returns"][number];
type Entry = Database["public"]["Functions"]["list_tournament_entries"]["Returns"][number];
type Match = Database["public"]["Functions"]["list_tournament_matches"]["Returns"][number];
type Pending = Database["public"]["Functions"]["list_pending_tournament_entries"]["Returns"][number] & {
  proofUrl: string | null;
};
type Court = { id: string; name: string };
type Member = { person_id: string; full_name: string };
type TournamentRate = { id: string; name: string; price_amount: number };

const ENTRY_STATUS_COPY: Record<Entry["status"], { label: string; tone: string } | null> = {
  pending: { label: "Pendiente", tone: "border-border bg-surface-container text-on-surface-variant" },
  active: null,
  cancelled: { label: "Rechazada", tone: "border-blocked-border bg-blocked-bg text-blocked-fg" },
};

const FORMAT_LABELS: Record<Tournament["format"], string> = {
  single_elimination: "Eliminación directa",
  round_robin: "Round robin",
  group_knockout: "Grupos + eliminatoria",
};

export function TournamentsManager({
  tournaments,
  courts,
  members,
  rates,
  currency,
  pending,
  selectedId,
  entries,
  matches,
}: {
  tournaments: Tournament[];
  courts: Court[];
  members: Member[];
  rates: TournamentRate[];
  currency: string;
  pending: Pending[];
  selectedId: string;
  entries: Entry[];
  matches: Match[];
}) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tournaments;
    return tournaments.filter(
      (t) => t.name.toLowerCase().includes(term) || (t.category ?? "").toLowerCase().includes(term),
    );
  }, [tournaments, search]);

  const selected = tournaments.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Torneos</h1>
        <p className="text-body-md text-on-surface-variant">
          Cuadro, inscripciones, agenda y resultados.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat label="Torneos" value={tournaments.length} />
        <Stat label="Activos" value={tournaments.filter((t) => t.active).length} />
        <Stat label="Solicitudes" value={pending.length} />
      </div>

      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-headline-sm text-on-surface">
            Solicitudes pendientes ({pending.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {pending.map((p) => (
              <PendingRow key={p.id} item={p} />
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o categoría…"
          className="h-10 w-full rounded-lg border border-border bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary sm:max-w-xs"
        />
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            add
          </span>
          Nuevo torneo
        </Button>
      </div>

      {createOpen && (
        <CreatePanel onClose={() => setCreateOpen(false)} rates={rates} currency={currency} />
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-container-lowest shadow-sm">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-border text-label-sm text-on-surface-variant">
              <th className="px-4 py-3 font-medium">Torneo</th>
              <th className="px-4 py-3 font-medium">Formato</th>
              <th className="px-4 py-3 font-medium">Inscritos</th>
              <th className="px-4 py-3 font-medium">Cuadro</th>
              <th className="px-4 py-3 font-medium">Inscripción</th>
              <th className="px-4 py-3 font-medium">Ver</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="text-body-md-medium text-on-surface">{t.name}</p>
                  {t.category && <p className="text-label-xs text-on-surface-variant">{t.category}</p>}
                </td>
                <td className="px-4 py-3 text-body-md text-on-surface">{FORMAT_LABELS[t.format]}</td>
                <td className="px-4 py-3 text-body-md text-on-surface">{t.entry_count}</td>
                <td className="px-4 py-3 text-label-xs text-on-surface-variant">
                  {t.bracket_generated ? "Generado" : "Pendiente"}
                </td>
                <td className="px-4 py-3">
                  <RegistrationToggle tournamentId={t.id} open={t.registration_open} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`?tournament=${t.id}`}>
                    <IconButton icon="visibility" label="Ver torneo" type="button" />
                  </Link>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-body-md text-on-surface-variant">
                  No hay torneos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <TournamentDetail
          tournament={selected}
          entries={entries}
          matches={matches}
          courts={courts}
          members={members}
        />
      )}
    </div>
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

function RegistrationToggle({ tournamentId, open }: { tournamentId: string; open: boolean }) {
  const [state, formAction, pending] = useActionState(toggleRegistration, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <input type="hidden" name="open" value={(!open).toString()} />
      <Switch
        id={`tournament-open-${tournamentId}`}
        label={open ? "Abierta" : "Cerrada"}
        checked={open}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
      />
      {state?.error && <span className="text-label-xs text-blocked-fg">{state.error}</span>}
    </form>
  );
}

function PendingRow({ item }: { item: Pending }) {
  const [state, formAction, pending] = useActionState(reviewEntry, undefined);
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blocked-border bg-blocked-bg/40 p-3">
      <div>
        <p className="text-body-md-medium text-on-surface">{item.person_name}</p>
        <p className="text-label-xs text-on-surface-variant">
          Solicitud de inscripción · {item.tournament_name}
        </p>
        {item.proofUrl && (
          <a
            href={item.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label-xs text-primary hover:underline"
          >
            Ver comprobante →
          </a>
        )}
      </div>
      {noteOpen ? (
        <form action={formAction} className="flex items-center gap-1">
          <input type="hidden" name="entry_id" value={item.id} />
          <input
            type="text"
            name="note"
            placeholder="Motivo (opcional)"
            className="h-8 w-40 rounded-lg border border-border bg-surface-container-lowest px-2 text-label-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary"
          />
          <IconButton
            icon="cancel"
            label="Confirmar rechazo"
            tone="danger"
            type="submit"
            name="approve"
            value="false"
            disabled={pending}
          />
          <IconButton icon="close" label="Cancelar" type="button" onClick={() => setNoteOpen(false)} />
        </form>
      ) : (
        <div className="flex items-center gap-1">
          <form action={formAction}>
            <input type="hidden" name="entry_id" value={item.id} />
            <input type="hidden" name="approve" value="true" />
            <IconButton icon="check_circle" label="Aprobar" type="submit" disabled={pending} />
          </form>
          <IconButton icon="cancel" label="Rechazar" tone="danger" onClick={() => setNoteOpen(true)} />
        </div>
      )}
      {state?.error && <p className="w-full text-label-xs text-blocked-fg">{state.error}</p>}
    </li>
  );
}

function CreatePanel({
  onClose,
  rates,
  currency,
}: {
  onClose: () => void;
  rates: TournamentRate[];
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(createTournament, undefined);
  const [format, setFormat] = useState<Tournament["format"]>("single_elimination");

  useEffect(() => {
    if (state?.message) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm text-on-surface">Nuevo torneo</h2>
        <button type="button" onClick={onClose} className="text-label-sm text-on-surface-variant hover:text-on-surface">
          Cerrar
        </button>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="name" label="Nombre del torneo" placeholder="Ej. Copa de Octubre" required />
          <Field id="category" label="Categoría (opcional)" placeholder="Ej. Singles Open" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="format"
            label="Formato"
            value={format}
            onChange={(e) => setFormat(e.target.value as Tournament["format"])}
          >
            <option value="single_elimination">Eliminación directa</option>
            <option value="round_robin">Round robin (grupos)</option>
            <option value="group_knockout">Grupos + eliminatoria</option>
          </Select>
          <Field id="start_date" label="Fecha de inicio (opcional)" type="date" />
        </div>
        <Select id="rate_id" label="Tarifa de inscripción (opcional)" defaultValue="">
          <option value="">Gratis</option>
          {rates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} — {formatMoney(r.price_amount, currency)}
            </option>
          ))}
        </Select>
        {format !== "single_elimination" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="group_size"
              label="Tamaño de grupo"
              type="number"
              min={2}
              defaultValue={4}
              hint="Ej. 4 — los grupos se arman automáticamente y lo más parejo posible."
              required
            />
            {format === "group_knockout" && (
              <Field
                id="advance_per_group"
                label="Clasifican por grupo"
                type="number"
                min={1}
                defaultValue={2}
                required
              />
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear torneo"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function TournamentDetail({
  tournament,
  entries,
  matches,
  courts,
  members,
}: {
  tournament: Tournament;
  entries: Entry[];
  matches: Match[];
  courts: Court[];
  members: Member[];
}) {
  const enrolledIds = new Set(entries.map((e) => e.person_id));
  const available = members.filter((m) => !enrolledIds.has(m.person_id));

  const [enrollState, enrollAction, enrollPending] = useActionState(registerEntry, undefined);
  const [genState, genAction, genPending] = useActionState(generateBracket, undefined);
  const [knockoutState, knockoutAction, knockoutPending] = useActionState(generateKnockoutPhase, undefined);

  const groupMatches = matches.filter((m) => m.phase === "group");
  const knockoutMatches = matches.filter((m) => m.phase === "knockout");
  const groupsComplete = groupMatches.length > 0 && groupMatches.every((m) => m.status === "completed");

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-headline-sm text-on-surface">{tournament.name}</h2>
          <p className="text-label-xs text-on-surface-variant">
            {FORMAT_LABELS[tournament.format]}
            {tournament.category ? ` · ${tournament.category}` : ""}
          </p>
        </div>
        <Link href="?" className="text-label-sm text-on-surface-variant hover:text-on-surface">
          Cerrar
        </Link>
      </div>

      {!tournament.bracket_generated && (
        <div className="flex flex-col gap-3">
          <h3 className="text-body-md-medium text-on-surface">
            Inscritos ({entries.length})
          </h3>
          {available.length > 0 && (
            <form action={enrollAction} className="flex items-end gap-2">
              <input type="hidden" name="tournament_id" value={tournament.id} />
              <Select id="person_id" label="Inscribir socio">
                {available.map((m) => (
                  <option key={m.person_id} value={m.person_id}>
                    {m.full_name}
                  </option>
                ))}
              </Select>
              <Button type="submit" disabled={enrollPending} className="mb-0.5">
                {enrollPending ? "Inscribiendo…" : "Inscribir"}
              </Button>
            </form>
          )}
          {enrollState?.error && <Alert tone="error">{enrollState.error}</Alert>}
          <ul className="flex flex-col gap-1.5">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
            {entries.length === 0 && (
              <li className="text-label-xs text-on-surface-variant">Nadie inscrito todavía.</li>
            )}
          </ul>

          <form action={genAction} className="flex items-center gap-2">
            <input type="hidden" name="tournament_id" value={tournament.id} />
            <Button type="submit" disabled={genPending || entries.length < 2}>
              {genPending ? "Generando…" : "Generar cuadro"}
            </Button>
            {entries.length < 2 && (
              <span className="text-label-xs text-on-surface-variant">Necesitas al menos 2 inscritos.</span>
            )}
          </form>
          {genState?.error && <Alert tone="error">{genState.error}</Alert>}
        </div>
      )}

      {tournament.bracket_generated && groupMatches.length > 0 && (
        <GroupsView entries={entries} matches={groupMatches} courts={courts} />
      )}

      {tournament.bracket_generated && tournament.format === "group_knockout" && !tournament.knockout_generated && (
        <div className="flex items-center gap-2">
          <form action={knockoutAction}>
            <input type="hidden" name="tournament_id" value={tournament.id} />
            <Button type="submit" disabled={knockoutPending || !groupsComplete}>
              {knockoutPending ? "Generando…" : "Generar fase eliminatoria"}
            </Button>
          </form>
          {!groupsComplete && (
            <span className="text-label-xs text-on-surface-variant">
              Carga el resultado de todos los partidos de grupo primero.
            </span>
          )}
        </div>
      )}
      {knockoutState?.error && <Alert tone="error">{knockoutState.error}</Alert>}

      {knockoutMatches.length > 0 && <BracketView matches={knockoutMatches} courts={courts} />}
    </section>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  const [state, formAction, pending] = useActionState(withdrawEntry, undefined);
  const statusCopy = ENTRY_STATUS_COPY[entry.status];
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-surface-container px-3 py-1.5">
      <span className="text-body-md text-on-surface">
        {entry.full_name}
        {entry.group_label && (
          <span className="ml-1.5 text-label-xs text-on-surface-variant">Grupo {entry.group_label}</span>
        )}
        {statusCopy && (
          <span className={`ml-1.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-label-xs ${statusCopy.tone}`}>
            {statusCopy.label}
          </span>
        )}
      </span>
      <form action={formAction}>
        <input type="hidden" name="entry_id" value={entry.id} />
        <IconButton
          icon="person_remove"
          label="Retirar inscripción"
          tone="danger"
          type="submit"
          disabled={pending}
        />
      </form>
      {state?.error && <p className="text-label-xs text-blocked-fg">{state.error}</p>}
    </li>
  );
}

function GroupsView({
  entries,
  matches,
  courts,
}: {
  entries: Entry[];
  matches: Match[];
  courts: Court[];
}) {
  const groupLabels = [...new Set(entries.map((e) => e.group_label).filter((g): g is string => !!g))].sort();

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-body-md-medium text-on-surface">Fase de grupos</h3>
      {groupLabels.map((label) => {
        const groupEntries = entries.filter((e) => e.group_label === label);
        const groupMatches = matches.filter(
          (m) => groupEntries.some((e) => e.id === m.entry1_id) || groupEntries.some((e) => e.id === m.entry2_id),
        );
        const standings = computeStandings(
          groupEntries.map((e) => ({ id: e.id, seed: e.seed })),
          groupMatches.map((m) => ({
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
              {groupMatches.map((m) => (
                <MatchRow key={m.id} match={m} courts={courts} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function BracketView({ matches, courts }: { matches: Match[]; courts: Court[] }) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-body-md-medium text-on-surface">Cuadro de eliminación</h3>
      {rounds.map((round) => (
        <div key={round} className="flex flex-col gap-2">
          <p className="text-label-sm font-medium text-on-surface">
            {round === rounds[rounds.length - 1] ? "Final" : `Ronda ${round}`}
          </p>
          <ul className="flex flex-col gap-1.5">
            {matches
              .filter((m) => m.round === round)
              .map((m) => (
                <MatchRow key={m.id} match={m} courts={courts} />
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MatchRow({ match, courts }: { match: Match; courts: Court[] }) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [schedState, schedAction, schedPending] = useActionState(scheduleMatch, undefined);
  const [resultState, resultAction, resultPending] = useActionState(reportMatchResult, undefined);

  const bothKnown = !!match.entry1_id && !!match.entry2_id;
  const label1 = match.entry1_name ?? (bothKnown ? "?" : "Bye");
  const label2 = match.entry2_name ?? (bothKnown ? "?" : "Bye");

  return (
    <li className="flex flex-col gap-2 rounded-lg bg-surface-container px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
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
        </div>
        {bothKnown && match.status !== "completed" && (
          <div className="flex gap-1">
            <IconButton icon="event" label="Agendar partido" onClick={() => setScheduleOpen((v) => !v)} />
            <IconButton icon="emoji_events" label="Cargar resultado" onClick={() => setResultOpen((v) => !v)} />
          </div>
        )}
      </div>

      {scheduleOpen && (
        <form action={schedAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
          <input type="hidden" name="match_id" value={match.id} />
          <Select id={`court-${match.id}`} name="court_id" label="Cancha">
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Field id={`date-${match.id}`} name="date" label="Fecha" type="date" required />
          <Field id={`start-${match.id}`} name="start_time" label="Hora inicio" type="time" defaultValue="09:00" required />
          <Field id={`end-${match.id}`} name="end_time" label="Hora fin" type="time" defaultValue="10:30" required />
          <Button type="submit" disabled={schedPending} className="mb-0.5">
            {schedPending ? "Agendando…" : "Agendar"}
          </Button>
        </form>
      )}
      {schedState?.error && <Alert tone="error">{schedState.error}</Alert>}

      {resultOpen && (
        <form action={resultAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
          <input type="hidden" name="match_id" value={match.id} />
          <Select id={`winner-${match.id}`} name="winner_entry_id" label="Ganador">
            <option value={match.entry1_id ?? ""}>{match.entry1_name}</option>
            <option value={match.entry2_id ?? ""}>{match.entry2_name}</option>
          </Select>
          <Field id={`score-${match.id}`} name="score" label="Marcador (opcional)" placeholder="6-4, 6-3" />
          <Button type="submit" disabled={resultPending} className="mb-0.5">
            {resultPending ? "Guardando…" : "Guardar resultado"}
          </Button>
        </form>
      )}
      {resultState?.error && <Alert tone="error">{resultState.error}</Alert>}
    </li>
  );
}
