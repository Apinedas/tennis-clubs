"use client";

import { useActionState, useEffect, useState } from "react";
import { blockCourt, cancelReservation, createReservation } from "@/app/actions/admin-booking";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

type Court = { id: string; name: string };
type Member = { person_id: string; full_name: string };
type Coach = { person_id: string; full_name: string };

export function ScheduleToolbar({
  courts,
  members,
  coaches,
  date,
}: {
  courts: Court[];
  members: Member[];
  coaches: Coach[];
  date: string;
}) {
  const [open, setOpen] = useState<"create" | "block" | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(open === "block" ? null : "block")}
        >
          Bloquear cancha
        </Button>
        <Button type="button" onClick={() => setOpen(open === "create" ? null : "create")}>
          Crear reserva
        </Button>
      </div>

      {open === "block" && (
        <BlockCourtForm courts={courts} date={date} onClose={() => setOpen(null)} />
      )}
      {open === "create" && (
        <CreateReservationForm
          courts={courts}
          members={members}
          coaches={coaches}
          date={date}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function BlockCourtForm({
  courts,
  date,
  onClose,
}: {
  courts: Court[];
  date: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(blockCourt, undefined);

  useEffect(() => {
    if (state?.message) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm text-on-surface">Bloquear cancha</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-label-sm text-on-surface-variant hover:text-on-surface"
        >
          Cerrar
        </button>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="court_id" label="Cancha" defaultValue={state?.fields?.court_id ?? ""}>
            <option value="" disabled>
              Elige una cancha
            </option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Field id="date" label="Fecha" type="date" defaultValue={state?.fields?.date ?? date} required />
          <Field id="start_time" label="Desde" type="time" defaultValue={state?.fields?.start_time ?? "06:00"} required />
          <Field id="end_time" label="Hasta" type="time" defaultValue={state?.fields?.end_time ?? "08:00"} required />
        </div>
        <Field id="reason" label="Motivo (opcional)" placeholder="Ej. Mantenimiento, lluvia" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Bloqueando…" : "Bloquear cancha"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function CreateReservationForm({
  courts,
  members,
  coaches,
  date,
  onClose,
}: {
  courts: Court[];
  members: Member[];
  coaches: Coach[];
  date: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createReservation, undefined);
  const [kind, setKind] = useState<"member" | "guest" | "lesson">("member");

  useEffect(() => {
    if (state?.message) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm text-on-surface">Crear reserva</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-label-sm text-on-surface-variant hover:text-on-surface"
        >
          Cerrar
        </button>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <div className="flex gap-4">
        {(["member", "guest", "lesson"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 text-body-md text-on-surface">
            <input
              type="radio"
              checked={kind === k}
              onChange={() => setKind(k)}
              className="h-4 w-4 accent-primary"
            />
            {k === "member" ? "Socio" : k === "guest" ? "Invitado" : "Clase con entrenador"}
          </label>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="court_id" label="Cancha" defaultValue={state?.fields?.court_id ?? ""}>
            <option value="" disabled>
              Elige una cancha
            </option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Field id="date" label="Fecha" type="date" defaultValue={state?.fields?.date ?? date} required />
          <Field id="start_time" label="Desde" type="time" defaultValue={state?.fields?.start_time ?? "06:00"} required />
          <Field id="end_time" label="Hasta" type="time" defaultValue={state?.fields?.end_time ?? "07:00"} required />
        </div>

        {kind === "member" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select id="person_id" label="Socio">
              <option value="" disabled>
                Elige un socio
              </option>
              {members.map((m) => (
                <option key={m.person_id} value={m.person_id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
            <ModalitySelect />
          </div>
        )}

        {kind === "guest" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="guest_name" label="Nombre del invitado" required />
            <ModalitySelect />
          </div>
        )}

        {kind === "lesson" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select id="coach_id" label="Entrenador">
              <option value="" disabled>
                Elige un entrenador
              </option>
              {coaches.map((c) => (
                <option key={c.person_id} value={c.person_id}>
                  {c.full_name}
                </option>
              ))}
            </Select>
            <Select id="person_id" label="Alumno">
              <option value="" disabled>
                Elige un alumno
              </option>
              {members.map((m) => (
                <option key={m.person_id} value={m.person_id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear reserva"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ModalitySelect() {
  return (
    <Select id="type" label="Modalidad" defaultValue="singles">
      <option value="singles">Sencillos</option>
      <option value="doubles">Dobles</option>
    </Select>
  );
}

export function CancelReservationButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(cancelReservation, undefined);

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
      {state?.error && <p className="mt-1 text-label-xs text-blocked-fg">{state.error}</p>}
    </form>
  );
}
