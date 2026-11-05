"use client";

import { useActionState, useState } from "react";
import { requestLesson } from "@/app/actions/lesson-booking";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const NOTES_MAX = 250;

// Wraps the note (applies to whichever slot the student ends up picking)
// and the grid of slot buttons in one client component, since the note has
// to reach whichever slot's form actually gets submitted.
export function LessonRequestPanel({
  coachId,
  date,
  slots,
}: {
  coachId: string;
  date: string;
  slots: { startsAtUtc: string; endsAtUtc: string; label: string }[];
}) {
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-label-sm text-on-surface-variant">
          ¿Qué quieres trabajar en esta clase? (Opcional)
        </label>
        <textarea
          id="notes"
          rows={2}
          maxLength={NOTES_MAX}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. Corrección técnica de revés a dos manos, saque plano…"
          className="rounded-lg border border-border bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary"
        />
        <span className="self-end text-label-xs text-on-surface-variant">
          {notes.length}/{NOTES_MAX}
        </span>
        <span className="text-label-xs text-on-surface-variant">
          Esta nota se enviará directamente al entrenador con tu solicitud.
        </span>
      </div>

      {slots.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          No hay horarios libres ese día. Prueba con otra fecha.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {slots.map((slot) => (
            <RequestSlotButton
              key={slot.startsAtUtc}
              coachId={coachId}
              date={date}
              notes={notes}
              startsAtUtc={slot.startsAtUtc}
              endsAtUtc={slot.endsAtUtc}
              label={slot.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestSlotButton({
  coachId,
  date,
  notes,
  startsAtUtc,
  endsAtUtc,
  label,
}: {
  coachId: string;
  date: string;
  notes: string;
  startsAtUtc: string;
  endsAtUtc: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(requestLesson, undefined);

  if (state?.message) {
    return <Alert>{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="coach_id" value={coachId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="starts_at" value={startsAtUtc} />
      <input type="hidden" name="ends_at" value={endsAtUtc} />
      <div className="flex flex-col gap-1">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Enviando…" : label}
        </Button>
        {state?.error && <span className="text-label-xs text-blocked-fg">{state.error}</span>}
      </div>
    </form>
  );
}
