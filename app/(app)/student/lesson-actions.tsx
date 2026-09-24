"use client";

import { useActionState } from "react";
import { cancelMyLesson, requestLesson } from "@/app/actions/lesson-booking";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function RequestSlotButton({
  coachId,
  date,
  startsAtUtc,
  endsAtUtc,
  label,
}: {
  coachId: string;
  date: string;
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

export function CancelLessonButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(cancelMyLesson, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("¿Cancelar esta clase?")) e.preventDefault();
        }}
        className="text-label-sm text-blocked-fg hover:underline disabled:opacity-60"
      >
        Cancelar
      </button>
      {state?.error && <p className="text-label-xs text-blocked-fg">{state.error}</p>}
    </form>
  );
}
