"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  createCourt,
  deleteCourt,
  toggleCourtActive,
  updateCourt,
} from "@/app/actions/court-settings";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { Database } from "@/lib/database.types";
import { SURFACE_LABELS, SURFACE_OPTIONS } from "@/lib/labels";

type Court = Database["public"]["Tables"]["court"]["Row"];
type Surface = Court["surface"];

export function CourtsManager({ courts }: { courts: Court[] }) {
  const [search, setSearch] = useState("");
  const [surfaceFilter, setSurfaceFilter] = useState<Surface | "all">("all");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);

  const countsBySurface = useMemo(() => {
    const counts = new Map<Surface, number>();
    for (const court of courts) {
      counts.set(court.surface, (counts.get(court.surface) ?? 0) + 1);
    }
    return counts;
  }, [courts]);

  const visibleCourts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return courts.filter((c) => {
      if (surfaceFilter !== "all" && c.surface !== surfaceFilter) return false;
      if (term && !c.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [courts, search, surfaceFilter]);

  const activeCount = courts.filter((c) => c.active).length;
  const litCount = courts.filter((c) => c.has_lighting).length;

  function openCreate() {
    setEditingCourt(null);
    setPanelOpen(true);
  }

  function openEdit(court: Court) {
    setEditingCourt(court);
    setPanelOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Gestión de Canchas</h1>
        <p className="text-body-md text-on-surface-variant">
          Administra las canchas del club, su superficie y disponibilidad.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat label="Canchas" value={courts.length} />
        <Stat label="Activas" value={activeCount} />
        <Stat label="Con iluminación" value={litCount} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="h-10 w-full max-w-xs rounded-lg border border-border bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary"
          />
          <FilterChip
            label={`Todas (${courts.length})`}
            active={surfaceFilter === "all"}
            onClick={() => setSurfaceFilter("all")}
          />
          {SURFACE_OPTIONS.filter(([value]) => countsBySurface.has(value)).map(
            ([value, label]) => (
              <FilterChip
                key={value}
                label={`${label} (${countsBySurface.get(value)})`}
                active={surfaceFilter === value}
                onClick={() => setSurfaceFilter(value)}
              />
            ),
          )}
        </div>
        <Button type="button" onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            add
          </span>
          Agregar cancha
        </Button>
      </div>

      {panelOpen && (
        <CourtPanel
          court={editingCourt}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-container-lowest shadow-sm">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-border text-label-sm text-on-surface-variant">
              <th className="px-4 py-3 font-medium">Cancha</th>
              <th className="px-4 py-3 font-medium">Superficie</th>
              <th className="px-4 py-3 font-medium">Cubierta</th>
              <th className="px-4 py-3 font-medium">Iluminación</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleCourts.map((court) => (
              <tr key={court.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="text-body-md-medium text-on-surface">{court.name}</p>
                  {court.notes && (
                    <p className="text-label-xs text-on-surface-variant">{court.notes}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-body-md text-on-surface">
                  {SURFACE_LABELS[court.surface]}
                </td>
                <td className="px-4 py-3">
                  <BoolBadge value={court.covered} />
                </td>
                <td className="px-4 py-3">
                  <BoolBadge value={court.has_lighting} />
                </td>
                <td className="px-4 py-3">
                  <ActiveToggle courtId={court.id} active={court.active} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEdit(court)}
                      className="text-label-sm text-primary hover:underline"
                    >
                      Editar
                    </button>
                    <DeleteCourtButton courtId={court.id} />
                  </div>
                </td>
              </tr>
            ))}
            {visibleCourts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-body-md text-on-surface-variant"
                >
                  No hay canchas que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface-container-lowest px-4 py-2">
      <span className="text-label-xs uppercase text-on-surface-variant">{label}</span>
      <span className="text-body-md-medium text-on-surface">{value}</span>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-primary px-3 py-1.5 text-label-sm text-on-primary"
          : "rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface-variant hover:bg-surface-container"
      }
    >
      {label}
    </button>
  );
}

function BoolBadge({ value }: { value: boolean }) {
  return (
    <span
      className={
        value
          ? "inline-flex items-center gap-1 rounded-md border border-available-border bg-available-bg px-2 py-0.5 text-label-xs text-available-fg"
          : "inline-flex items-center gap-1 rounded-md border border-border bg-surface-container px-2 py-0.5 text-label-xs text-on-surface-variant"
      }
    >
      {value ? "Sí" : "No"}
    </span>
  );
}

function ActiveToggle({ courtId, active }: { courtId: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(toggleCourtActive, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="court_id" value={courtId} />
      <input type="hidden" name="active" value={(!active).toString()} />
      <Checkbox
        id={`active-${courtId}`}
        label={active ? "Activa" : "Inactiva"}
        checked={active}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
      />
      {state?.error && (
        <span className="mt-1 block text-label-xs text-blocked-fg">{state.error}</span>
      )}
    </form>
  );
}

function DeleteCourtButton({ courtId }: { courtId: string }) {
  const [state, formAction, pending] = useActionState(deleteCourt, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="court_id" value={courtId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (
            !confirm("¿Eliminar esta cancha? Esta acción no se puede deshacer.")
          ) {
            e.preventDefault();
          }
        }}
        className="text-label-sm text-blocked-fg hover:underline disabled:opacity-60"
      >
        Eliminar
      </button>
      {state?.error && (
        <p className="mt-1 max-w-[220px] text-label-xs text-blocked-fg">{state.error}</p>
      )}
    </form>
  );
}

function CourtPanel({
  court,
  onClose,
}: {
  court: Court | null;
  onClose: () => void;
}) {
  const action = court ? updateCourt : createCourt;
  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.message) onClose();
    // Only react to a successful save; onClose is stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm text-on-surface">
          {court ? "Editar cancha" : "Agregar cancha"}
        </h2>
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
        {court && <input type="hidden" name="court_id" value={court.id} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="name"
            label="Nombre de la cancha"
            defaultValue={state?.fields?.name ?? court?.name ?? ""}
            placeholder="Ej. Cancha 1"
            required
          />
          <Select
            id="surface"
            label="Tipo de superficie"
            defaultValue={state?.fields?.surface ?? court?.surface ?? "clay"}
          >
            {SURFACE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-6">
          <Checkbox
            id="covered"
            label="Cubierta"
            defaultChecked={court?.covered ?? false}
          />
          <Checkbox
            id="has_lighting"
            label="Con iluminación"
            defaultChecked={court?.has_lighting ?? false}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="text-label-sm text-on-surface-variant">
            Notas (opcional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={state?.fields?.notes ?? court?.notes ?? ""}
            placeholder="Ej. Sistema de riego automático perimetral"
            className="rounded-lg border border-border bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : court ? "Guardar cambios" : "Crear cancha"}
          </Button>
        </div>
      </form>
    </section>
  );
}
