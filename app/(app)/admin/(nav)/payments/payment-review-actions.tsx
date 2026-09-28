"use client";

import { useActionState, useState } from "react";
import { approvePayment, rejectPayment } from "@/app/actions/payments";
import { IconButton } from "@/components/ui/icon-button";

export function ApprovePaymentButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(approvePayment, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <IconButton
        icon="check_circle"
        label="Aprobar pago"
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("¿Aprobar este pago?")) e.preventDefault();
        }}
      />
      {state?.error && <p className="max-w-[160px] text-label-xs text-blocked-fg">{state.error}</p>}
    </form>
  );
}

export function RejectPaymentButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(rejectPayment, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <IconButton
        icon="cancel"
        label="Rechazar comprobante"
        tone="danger"
        onClick={() => setOpen(true)}
      />
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <input type="hidden" name="booking_id" value={bookingId} />
        <input
          type="text"
          name="note"
          placeholder="Motivo (opcional)"
          className="h-8 w-40 rounded-lg border border-border bg-surface-container-lowest px-2 text-label-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary"
        />
        <IconButton icon="cancel" label="Confirmar rechazo" tone="danger" type="submit" disabled={pending} />
        <IconButton icon="close" label="Cancelar" type="button" onClick={() => setOpen(false)} />
      </div>
      {state?.error && <p className="text-label-xs text-blocked-fg">{state.error}</p>}
    </form>
  );
}
