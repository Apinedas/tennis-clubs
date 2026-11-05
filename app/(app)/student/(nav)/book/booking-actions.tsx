"use client";

import { useActionState, useMemo, useState } from "react";
import { bookCourts } from "@/app/actions/court-booking";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
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
type CartItem = {
  key: string;
  courtId: string;
  courtName: string;
  startsAtUtc: string;
  endsAtUtc: string;
  label: string;
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
  const [selected, setSelected] = useState<Map<string, CartItem>>(new Map());
  const [state, formAction, pending] = useActionState(bookCourts, undefined);

  // Clear the cart once the action reports success — a render-time state
  // adjustment (not an effect) so it can't trigger a second cascading
  // render; see https://react.dev/learn/you-might-not-need-an-effect.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.message) setSelected(new Map());
  }

  function toggleSlot(court: CourtWithSlots, slot: Slot) {
    const key = `${court.id}-${slot.startsAtUtc}`;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, {
          key,
          courtId: court.id,
          courtName: court.name,
          startsAtUtc: slot.startsAtUtc,
          endsAtUtc: slot.endsAtUtc,
          label: formatLocalTime(slot.startsAtUtc, timeZone),
        });
      }
      return next;
    });
  }

  function removeItem(key: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  const items = useMemo(
    () => Array.from(selected.values()).sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc)),
    [selected],
  );

  return (
    <div className="flex flex-col gap-4 pb-2">
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
              {court.slots.map((slot) => {
                const key = `${court.id}-${slot.startsAtUtc}`;
                const isSelected = selected.has(key);
                return (
                  <button
                    key={slot.startsAtUtc}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSlot(court, slot)}
                    className={
                      isSelected
                        ? "w-full rounded-lg border border-primary bg-primary px-3 py-2.5 text-body-md-medium text-on-primary"
                        : "w-full rounded-lg border border-border bg-surface-container-lowest px-3 py-2.5 text-body-md-medium text-on-surface hover:bg-surface-container"
                    }
                  >
                    {formatLocalTime(slot.startsAtUtc, timeZone)}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ))}

      {items.length > 0 && (
        <CartSummary
          items={items}
          type={type}
          date={date}
          pending={pending}
          state={state}
          formAction={formAction}
          onRemove={removeItem}
          onClear={() => setSelected(new Map())}
        />
      )}
    </div>
  );
}

function CartSummary({
  items,
  type,
  date,
  pending,
  state,
  formAction,
  onRemove,
  onClear,
}: {
  items: CartItem[];
  type: BookingType;
  date: string;
  pending: boolean;
  state: { error?: string; message?: string } | undefined;
  formAction: (formData: FormData) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  const plural = items.length > 1 ? "s" : "";

  return (
    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-primary bg-surface-container-lowest p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-body-md-medium text-on-surface">
          {items.length} horario{plural} seleccionado{plural}
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="text-label-sm text-on-surface-variant hover:text-on-surface"
        >
          Vaciar
        </button>
      </div>

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.message && <Alert>{state.message}</Alert>}

      <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-2 rounded-lg bg-surface-container px-3 py-1.5 text-body-md text-on-surface"
          >
            <span>
              {item.courtName} · {item.label}
            </span>
            <IconButton
              icon="close"
              label={`Quitar ${item.courtName} ${item.label}`}
              onClick={() => onRemove(item.key)}
              className="h-6 w-6"
            />
          </li>
        ))}
      </ul>

      <p className="text-label-xs text-on-surface-variant">
        Pendiente de pago en recepción.
      </p>

      <form action={formAction}>
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="date" value={date} />
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(
            items.map(({ courtId, startsAtUtc, endsAtUtc }) => ({ courtId, startsAtUtc, endsAtUtc })),
          )}
        />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Confirmando…" : `Confirmar ${items.length} reserva${plural}`}
        </Button>
      </form>
    </div>
  );
}
