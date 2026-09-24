"use client";

import { useActionState } from "react";
import { respondToLessonRequest } from "@/app/actions/lesson-booking";

export function RespondButtons({ bookingId }: { bookingId: string }) {
  const [acceptState, acceptAction, acceptPending] = useActionState(
    respondToLessonRequest,
    undefined,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    respondToLessonRequest,
    undefined,
  );
  const error = acceptState?.error ?? rejectState?.error;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={rejectAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="decision" value="reject" />
          <button
            type="submit"
            disabled={acceptPending || rejectPending}
            onClick={(e) => {
              if (!confirm("¿Rechazar esta solicitud de clase?")) e.preventDefault();
            }}
            className="rounded-lg border border-border bg-surface-container-lowest px-3 py-1.5 text-label-sm text-on-surface hover:bg-background disabled:opacity-60"
          >
            {rejectPending ? "Rechazando…" : "Rechazar"}
          </button>
        </form>
        <form action={acceptAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="decision" value="accept" />
          <button
            type="submit"
            disabled={acceptPending || rejectPending}
            className="rounded-lg bg-primary px-3 py-1.5 text-label-sm text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {acceptPending ? "Aceptando…" : "Aceptar"}
          </button>
        </form>
      </div>
      {error && <p className="max-w-[200px] text-label-xs text-blocked-fg">{error}</p>}
    </div>
  );
}
