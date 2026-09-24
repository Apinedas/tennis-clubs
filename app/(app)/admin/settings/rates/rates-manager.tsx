"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  createRate,
  deleteRate,
  toggleRateActive,
  updateRate,
} from "@/app/actions/rate-settings";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Database } from "@/lib/database.types";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  formatMoney,
  SERVICE_LABELS,
  SERVICE_OPTIONS,
  SURFACE_LABELS,
  SURFACE_OPTIONS,
  WEEKDAYS,
} from "@/lib/labels";

type Rate = Database["public"]["Tables"]["rate"]["Row"];
type Court = Pick<Database["public"]["Tables"]["court"]["Row"], "id" | "name" | "surface">;
type Category = Database["public"]["Enums"]["rate_category"];

function assignmentLabel(rate: Rate, courts: Court[]) {
  if (rate.court_id) {
    return courts.find((c) => c.id === rate.court_id)?.name ?? "Cancha eliminada";
  }
  if (rate.surface) return `Todas las de ${SURFACE_LABELS[rate.surface]}`;
  return "Todas las canchas";
}

function weekdaysLabel(weekdays: number[]) {
  if (weekdays.length === 7) return "Todos los días";
  return WEEKDAYS.filter((d) => weekdays.includes(d.value))
    .map((d) => d.label)
    .join(", ");
}

export function RatesManager({
  rates,
  courts,
  currency,
}: {
  rates: Rate[];
  courts: Court[];
  currency: string;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);

  const visibleRates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rates.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (term && !r.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rates, search, categoryFilter]);

  const activeCount = rates.filter((r) => r.active).length;

  function openCreate() {
    setEditingRate(null);
    setPanelOpen(true);
  }

  function openEdit(rate: Rate) {
    setEditingRate(rate);
    setPanelOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Esquema de Tarifas</h1>
        <p className="text-body-md text-on-surface-variant">
          Precios de alquiler y clases por cancha, horario y categoría de usuario. Moneda: {currency}.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat label="Tarifas" value={rates.length} />
        <Stat label="Activas" value={activeCount} />
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
            label="Todos"
            active={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
          />
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <FilterChip
              key={value}
              label={label}
              active={categoryFilter === value}
              onClick={() => setCategoryFilter(value)}
            />
          ))}
        </div>
        <Button type="button" onClick={openCreate} disabled={courts.length === 0}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            add
          </span>
          Agregar tarifa
        </Button>
      </div>

      {courts.length === 0 && (
        <Alert>Crea al menos una cancha antes de configurar tarifas.</Alert>
      )}

      {panelOpen && (
        <RatePanel
          rate={editingRate}
          courts={courts}
          currency={currency}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-container-lowest shadow-sm">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-border text-label-sm text-on-surface-variant">
              <th className="px-4 py-3 font-medium">Tarifa / Asignación</th>
              <th className="px-4 py-3 font-medium">Servicio</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Horario</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRates.map((rate) => (
              <tr key={rate.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="text-body-md-medium text-on-surface">{rate.name}</p>
                  <p className="text-label-xs text-on-surface-variant">
                    {assignmentLabel(rate, courts)}
                  </p>
                </td>
                <td className="px-4 py-3 text-body-md text-on-surface">
                  {rate.service ? SERVICE_LABELS[rate.service] : "Todos"}
                </td>
                <td className="px-4 py-3 text-body-md text-on-surface">
                  {rate.category ? CATEGORY_LABELS[rate.category] : "Todos"}
                </td>
                <td className="px-4 py-3 text-body-md text-on-surface">
                  <p>
                    {rate.start_time.slice(0, 5)} - {rate.end_time.slice(0, 5)}
                  </p>
                  <p className="text-label-xs text-on-surface-variant">
                    {weekdaysLabel(rate.weekdays)}
                  </p>
                </td>
                <td className="px-4 py-3 text-body-md-medium text-on-surface">
                  {formatMoney(rate.price_amount, currency)}
                </td>
                <td className="px-4 py-3">
                  <ActiveToggle rateId={rate.id} active={rate.active} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <IconButton
                      icon="edit"
                      label="Editar tarifa"
                      onClick={() => openEdit(rate)}
                    />
                    <DeleteRateButton rateId={rate.id} />
                  </div>
                </td>
              </tr>
            ))}
            {visibleRates.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-body-md text-on-surface-variant"
                >
                  No hay tarifas que coincidan con la búsqueda.
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

function ActiveToggle({ rateId, active }: { rateId: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(toggleRateActive, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="rate_id" value={rateId} />
      <input type="hidden" name="active" value={(!active).toString()} />
      <Switch
        id={`rate-active-${rateId}`}
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

function DeleteRateButton({ rateId }: { rateId: string }) {
  const [state, formAction, pending] = useActionState(deleteRate, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="rate_id" value={rateId} />
      <IconButton
        icon="delete"
        label="Eliminar tarifa"
        tone="danger"
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("¿Eliminar esta tarifa? Esta acción no se puede deshacer.")) {
            e.preventDefault();
          }
        }}
      />
      {state?.error && (
        <p className="mt-1 max-w-[220px] text-label-xs text-blocked-fg">{state.error}</p>
      )}
    </form>
  );
}

type Assignment = "all" | "court" | "surface";

function RatePanel({
  rate,
  courts,
  currency,
  onClose,
}: {
  rate: Rate | null;
  courts: Court[];
  currency: string;
  onClose: () => void;
}) {
  const action = rate ? updateRate : createRate;
  const [state, formAction, pending] = useActionState(action, undefined);

  const [assignment, setAssignment] = useState<Assignment>(
    rate?.court_id ? "court" : rate?.surface ? "surface" : "all",
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    rate?.weekdays ?? [1, 2, 3, 4, 5, 6, 7],
  );

  useEffect(() => {
    if (state?.message) onClose();
    // Only react to a successful save; onClose is stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function toggleWeekday(value: number) {
    setWeekdays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm text-on-surface">
          {rate ? "Editar tarifa" : "Agregar tarifa"}
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
        {rate && <input type="hidden" name="rate_id" value={rate.id} />}
        <input type="hidden" name="assignment" value={assignment} />

        <Field
          id="name"
          label="Nombre de la tarifa"
          defaultValue={state?.fields?.name ?? rate?.name ?? ""}
          placeholder="Ej. Tarifa Socio Valle"
          required
        />

        <div className="flex flex-col gap-2">
          <span className="text-label-sm text-on-surface-variant">Aplica a</span>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-body-md text-on-surface">
              <input
                type="radio"
                checked={assignment === "all"}
                onChange={() => setAssignment("all")}
                className="h-4 w-4 accent-primary"
              />
              Todas las canchas
            </label>
            <label className="flex items-center gap-2 text-body-md text-on-surface">
              <input
                type="radio"
                checked={assignment === "court"}
                onChange={() => setAssignment("court")}
                className="h-4 w-4 accent-primary"
              />
              Una cancha específica
            </label>
            <label className="flex items-center gap-2 text-body-md text-on-surface">
              <input
                type="radio"
                checked={assignment === "surface"}
                onChange={() => setAssignment("surface")}
                className="h-4 w-4 accent-primary"
              />
              Todas las de una superficie
            </label>
          </div>
          {assignment === "court" && (
            <Select
              id="court_id"
              label="Cancha"
              defaultValue={state?.fields?.court_id ?? rate?.court_id ?? ""}
            >
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {assignment === "surface" && (
            <Select
              id="surface"
              label="Superficie"
              defaultValue={state?.fields?.surface ?? rate?.surface ?? "clay"}
            >
              {SURFACE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="category"
            label="Categoría de usuario"
            defaultValue={state?.fields?.category ?? rate?.category ?? ""}
            hint="Déjalo en 'Todos' para que aplique a socios y no socios."
          >
            <option value="">Todos</option>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            id="service"
            label="Servicio"
            defaultValue={state?.fields?.service ?? rate?.service ?? ""}
            hint="Déjalo en 'Todos' para sencillos, dobles y clases por igual."
          >
            <option value="">Todos</option>
            {SERVICE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="start_time"
            label="Hora de inicio"
            type="time"
            defaultValue={state?.fields?.start_time ?? rate?.start_time?.slice(0, 5) ?? "06:00"}
            required
          />
          <Field
            id="end_time"
            label="Hora de fin"
            type="time"
            defaultValue={state?.fields?.end_time ?? rate?.end_time?.slice(0, 5) ?? "22:00"}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-label-sm text-on-surface-variant">Días de la semana</span>
          <div className="flex flex-wrap gap-4">
            {WEEKDAYS.map((day) => (
              <Checkbox
                key={day.value}
                id={`weekday-${day.value}`}
                label={day.label}
                checked={weekdays.includes(day.value)}
                onChange={() => toggleWeekday(day.value)}
              />
            ))}
          </div>
          {weekdays.map((d) => (
            <input key={d} type="hidden" name="weekdays" value={d} />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="price_amount" className="text-label-sm text-on-surface-variant">
            Precio ({currency})
          </label>
          <input
            id="price_amount"
            name="price_amount"
            type="number"
            min={0}
            step={1}
            defaultValue={state?.fields?.price_amount ?? rate?.price_amount ?? ""}
            className="h-10 rounded-lg border border-border bg-surface-container-lowest px-3 text-body-md text-on-surface focus:border-primary"
            required
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : rate ? "Guardar cambios" : "Crear tarifa"}
          </Button>
        </div>
      </form>
    </section>
  );
}
