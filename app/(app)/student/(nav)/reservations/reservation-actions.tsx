"use client";

import { useActionState } from "react";
import { cancelMyReservation } from "@/app/actions/reservations";

export function CancelReservationButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(cancelMyReservation, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("¿Cancelar esta reserva?")) e.preventDefault();
        }}
        className="rounded-lg border border-border bg-surface-container-lowest px-3 py-1.5 text-label-sm text-blocked-fg hover:bg-blocked-bg disabled:opacity-60"
      >
        {pending ? "Cancelando…" : "Cancelar reserva"}
      </button>
      {state?.error && <p className="mt-1 max-w-[200px] text-label-xs text-blocked-fg">{state.error}</p>}
    </form>
  );
}
