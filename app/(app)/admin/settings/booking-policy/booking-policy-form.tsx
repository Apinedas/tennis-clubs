"use client";

import { useActionState } from "react";
import { updateBookingPolicy } from "@/app/actions/booking-policy-settings";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import type { Database } from "@/lib/database.types";

type Policy = Database["public"]["Tables"]["booking_policy"]["Row"];

export function BookingPolicyForm({ policy }: { policy: Policy }) {
  const [state, formAction, pending] = useActionState(
    updateBookingPolicy,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">
          Políticas y Reglas de Reservas
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Duración de turno y ventanas de tiempo para agendar y cancelar.
        </p>
      </div>

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.message && <Alert>{state.message}</Alert>}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
        <div>
          <h2 className="text-headline-sm text-on-surface">
            Duración y Ventanas de Reserva
          </h2>
          <p className="text-label-xs text-on-surface-variant">
            Límites de agendamiento aplicados en caseta y en el registro de socios.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            id="slot_minutes"
            label="Duración del turno (minutos)"
            type="number"
            min={1}
            max={480}
            defaultValue={state?.fields?.slot_minutes ?? policy.slot_minutes}
            hint="Tamaño de cada bloque en la grilla horaria."
            required
          />
          <Field
            id="min_advance_hours"
            label="Anticipación mínima para reservar (horas)"
            type="number"
            min={0}
            max={720}
            defaultValue={state?.fields?.min_advance_hours ?? policy.min_advance_hours}
            hint="No se permiten reservas de último momento antes de este límite."
            required
          />
          <Field
            id="max_advance_days"
            label="Anticipación máxima para reservar (días)"
            type="number"
            min={1}
            max={365}
            defaultValue={state?.fields?.max_advance_days ?? policy.max_advance_days}
            hint="Ventana máxima hacia el futuro en la grilla."
            required
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
        <div>
          <h2 className="text-headline-sm text-on-surface">
            Cancelaciones y Autogestión
          </h2>
          <p className="text-label-xs text-on-surface-variant">
            Cuándo se puede cancelar y qué puede hacer un socio por su cuenta.
          </p>
        </div>
        <Field
          id="cancellation_hours"
          label="Horas mínimas de cancelación"
          type="number"
          min={0}
          max={720}
          defaultValue={state?.fields?.cancellation_hours ?? policy.cancellation_hours}
          hint="Tiempo límite antes del turno para cancelar sin penalidad."
          required
        />
        <div className="flex flex-col gap-3">
          <Checkbox
            id="self_cancel_allowed"
            label="El alumno o socio puede cancelar por su cuenta"
            defaultChecked={policy.self_cancel_allowed}
          />
          <Checkbox
            id="accept_guests"
            label="Aceptar visitantes no socios"
            defaultChecked={policy.accept_guests}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
