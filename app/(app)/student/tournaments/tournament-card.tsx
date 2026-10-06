"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestTournamentEntry } from "@/app/actions/tournaments";
import type { Database } from "@/lib/database.types";

type Tournament = Database["public"]["Functions"]["list_club_tournaments"]["Returns"][number];

export function TournamentCard({
  tournament,
  formatLabel,
  myEntryId,
}: {
  tournament: Tournament;
  formatLabel: string;
  myEntryId: string | null;
}) {
  const [state, formAction, pending] = useActionState(requestTournamentEntry, undefined);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm">
      <div>
        <h3 className="text-headline-sm font-bold text-on-surface">{tournament.name}</h3>
        <p className="text-label-xs text-on-surface-variant">
          {formatLabel}
          {tournament.category ? ` · ${tournament.category}` : ""}
        </p>
      </div>
      <p className="text-label-sm text-on-surface-variant">{tournament.entry_count} inscritos</p>

      {myEntryId ? (
        <span className="inline-flex w-fit items-center rounded-md border border-available-border bg-available-bg px-2 py-0.5 text-label-xs text-available-fg">
          Inscrito
        </span>
      ) : tournament.registration_open ? (
        <form action={formAction} className="flex flex-col gap-1">
          <input type="hidden" name="tournament_id" value={tournament.id} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg px-4 py-2.5 text-center text-body-md-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {pending ? "Enviando…" : "Inscribirme"}
          </button>
          {state?.error && <span className="text-label-xs text-blocked-fg">{state.error}</span>}
          {state?.message && <span className="text-label-xs text-available-fg">{state.message}</span>}
        </form>
      ) : (
        <span className="text-label-xs text-on-surface-variant">Inscripciones cerradas</span>
      )}

      {tournament.bracket_generated && (
        <Link href={`?tournament=${tournament.id}`} className="text-label-sm text-primary hover:underline">
          Ver cuadro →
        </Link>
      )}
    </div>
  );
}
