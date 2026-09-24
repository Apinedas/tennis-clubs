"use client";

import { useActionState, useState } from "react";
import { bookCourt, cancelMyBooking } from "@/app/actions/court-booking";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatLocalTime } from "@/lib/slot-scheduling";
import type { Database } from "@/lib/database.types";

type BookingType = Database["public"]["Enums"]["booking_type"];
type Slot = { startsAtUtc: string; endsAtUtc: string; label: string };
type CourtWithSlots = {
  id: string;
  name: string;
  surface: string;
  covered: boolean;
  slots: Slot[];
};

export function BookingGrid({
  courts,
  date,
  timeZone,
}: {
  courts: CourtWithSlots[];
  date: string;
  timeZone: string;
}) {
  const [type, setType] = useState<BookingType>("singles");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="text-label-sm text-on-surface-variant">Modalidad</span>
        <label className="flex items-center gap-2 text-body-md text-on-surface">
          <input
            type="radio"
            checked={type === "singles"}
            onChange={() => setType("singles")}
            className="h-4 w-4 accent-primary"
          />
          Sencillos
        </label>
        <label className="flex items-center gap-2 text-body-md text-on-surface">
          <input
            type="radio"
            checked={type === "doubles"}
            onChange={() => setType("doubles")}
            className="h-4 w-4 accent-primary"
          />
          Dobles
        </label>
      </div>

      {courts.map((court) => (
        <section
          key={court.id}
          className="flex flex-col gap-2 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm"
        >
          <h3 className="text-body-md-medium text-on-surface">{court.name}</h3>
          {court.slots.length === 0 ? (
            <p className="text-label-xs text-on-surface-variant">
              Sin horarios libres ese día.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {court.slots.map((slot) => (
                <BookSlotButton
                  key={slot.startsAtUtc}
                  courtId={court.id}
                  date={date}
                  type={type}
                  startsAtUtc={slot.startsAtUtc}
                  endsAtUtc={slot.endsAtUtc}
                  label={formatLocalTime(slot.startsAtUtc, timeZone)}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function BookSlotButton({
  courtId,
  date,
  type,
  startsAtUtc,
  endsAtUtc,
  label,
}: {
  courtId: string;
  date: string;
  type: BookingType;
  startsAtUtc: string;
  endsAtUtc: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(bookCourt, undefined);

  if (state?.message) {
    return <Alert>{state.message}</Alert>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="court_id" value={courtId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="starts_at" value={startsAtUtc} />
      <input type="hidden" name="ends_at" value={endsAtUtc} />
      <div className="flex flex-col gap-1">
        <Button type="submit" variant="secondary" disabled={pending} className="w-full">
          {pending ? "…" : label}
        </Button>
        {state?.error && <span className="text-label-xs text-blocked-fg">{state.error}</span>}
      </div>
    </form>
  );
}

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(cancelMyBooking, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("¿Cancelar esta reserva?")) e.preventDefault();
        }}
        className="text-label-sm text-blocked-fg hover:underline disabled:opacity-60"
      >
        Cancelar
      </button>
      {state?.error && <p className="text-label-xs text-blocked-fg">{state.error}</p>}
    </form>
  );
}
