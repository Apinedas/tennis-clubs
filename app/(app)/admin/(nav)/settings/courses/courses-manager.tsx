"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  createCourse,
  enrollMember,
  removeEnrollment,
  reviewEnrollment,
  toggleCourseActive,
  updateCourse,
} from "@/app/actions/courses";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WEEKDAYS, formatMoney } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type Course = Database["public"]["Functions"]["list_club_courses"]["Returns"][number];
type Pending = Database["public"]["Functions"]["list_pending_enrollments"]["Returns"][number];
type RosterRow = Database["public"]["Functions"]["list_course_roster"]["Returns"][number];
type Court = { id: string; name: string };
type Coach = { person_id: string; full_name: string };
type CourseRate = { id: string; name: string; price_amount: number };
type Member = { person_id: string; full_name: string };

function weekdaysLabel(weekdays: number[]) {
  if (weekdays.length === 7) return "Todos los días";
  return WEEKDAYS.filter((d) => weekdays.includes(d.value)).map((d) => d.label).join(", ");
}

function courseStatus(c: Course) {
  const today = new Date().toISOString().slice(0, 10);
  if (!c.active) return { label: "Inactivo", tone: "off" as const };
  if (today > c.end_date) return { label: "Finalizado", tone: "off" as const };
  if (today >= c.start_date) return { label: "En curso", tone: "on" as const };
  return { label: "Inscripciones abiertas", tone: "on" as const };
}

export function CoursesManager({
  courses,
  pending,
  courts,
  coaches,
  courseRates,
  currency,
  rosterCourseId,
  roster,
  members,
}: {
  courses: Course[];
  pending: Pending[];
  courts: Court[];
  coaches: Coach[];
  courseRates: CourseRate[];
  currency: string;
  rosterCourseId: string;
  roster: RosterRow[] | null;
  members: Member[];
}) {
  const [search, setSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const visibleCourses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return courses;
    return courses.filter(
      (c) => c.name.toLowerCase().includes(term) || c.head_coach_name.toLowerCase().includes(term),
    );
  }, [courses, search]);

  const rosterCourse = courses.find((c) => c.id === rosterCourseId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Gestión de Cursos y Clínicas</h1>
        <p className="text-body-md text-on-surface-variant">
          Clases grupales recurrentes con cupo, inscripción y asistencia.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat label="Cursos" value={courses.length} />
        <Stat label="Vigentes" value={courses.filter((c) => c.active).length} />
        <Stat label="Solicitudes" value={pending.length} />
      </div>

      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-headline-sm text-on-surface">
            Solicitudes pendientes ({pending.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {pending.map((p) => (
              <PendingRow key={p.id} item={p} />
            ))}
          </ul>
        </section>
      )}

      {courts.length === 0 || coaches.length === 0 ? (
        <Alert>
          {courts.length === 0
            ? "Crea al menos una cancha antes de configurar un curso."
            : "Invita al menos un entrenador antes de configurar un curso."}
        </Alert>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre de curso o entrenador…"
              className="h-10 w-full rounded-lg border border-border bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary sm:max-w-xs"
            />
            <Button
              type="button"
              onClick={() => {
                setEditingCourse(null);
                setPanelOpen(true);
              }}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                add
              </span>
              Agregar curso
            </Button>
          </div>

          {panelOpen && (
            <CoursePanel
              course={editingCourse}
              courts={courts}
              coaches={coaches}
              courseRates={courseRates}
              currency={currency}
              onClose={() => setPanelOpen(false)}
            />
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-surface-container-lowest shadow-sm">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-border text-label-sm text-on-surface-variant">
                  <th className="px-4 py-3 font-medium">Curso</th>
                  <th className="px-4 py-3 font-medium">Entrenador</th>
                  <th className="px-4 py-3 font-medium">Horario</th>
                  <th className="px-4 py-3 font-medium">Cupo</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleCourses.map((c) => {
                  const status = courseStatus(c);
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <p className="text-body-md-medium text-on-surface">{c.name}</p>
                        <p className="text-label-xs text-on-surface-variant">
                          {c.court_name}
                          {c.level ? ` · ${c.level}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-body-md text-on-surface">{c.head_coach_name}</td>
                      <td className="px-4 py-3 text-body-md text-on-surface">
                        <p>
                          {c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}
                        </p>
                        <p className="text-label-xs text-on-surface-variant">
                          {weekdaysLabel(c.weekdays)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-body-md text-on-surface">
                        {c.enrolled_count}/{c.capacity}
                      </td>
                      <td className="px-4 py-3 text-body-md-medium text-on-surface">
                        {c.price_amount != null ? formatMoney(c.price_amount, currency) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            status.tone === "on"
                              ? "inline-flex items-center rounded-md border border-available-border bg-available-bg px-2 py-0.5 text-label-xs text-available-fg"
                              : "inline-flex items-center rounded-md border border-border bg-surface-container px-2 py-0.5 text-label-xs text-on-surface-variant"
                          }
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`?course=${c.id}`}>
                            <IconButton icon="groups" label="Ver alumnos inscritos" type="button" />
                          </Link>
                          <IconButton
                            icon="edit"
                            label="Editar curso"
                            onClick={() => {
                              setEditingCourse(c);
                              setPanelOpen(true);
                            }}
                          />
                          <ActiveToggle courseId={c.id} active={c.active} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visibleCourses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-body-md text-on-surface-variant">
                      No hay cursos que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {rosterCourse && (
        <RosterPanel course={rosterCourse} roster={roster ?? []} members={members} />
      )}
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

function ActiveToggle({ courseId, active }: { courseId: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(toggleCourseActive, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="active" value={(!active).toString()} />
      <Switch
        id={`course-active-${courseId}`}
        label={active ? "Activo" : "Inactivo"}
        checked={active}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
      />
      {state?.error && <span className="text-label-xs text-blocked-fg">{state.error}</span>}
    </form>
  );
}

function PendingRow({ item }: { item: Pending }) {
  const [state, formAction, pending] = useActionState(reviewEnrollment, undefined);
  const [noteOpen, setNoteOpen] = useState(false);
  const label = item.status === "pending" ? "Solicitud de inscripción" : "Solicitud de baja";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blocked-border bg-blocked-bg/40 p-3">
      <div>
        <p className="text-body-md-medium text-on-surface">{item.person_name}</p>
        <p className="text-label-xs text-on-surface-variant">
          {label} · {item.course_name}
        </p>
      </div>
      {noteOpen ? (
        <form action={formAction} className="flex items-center gap-1">
          <input type="hidden" name="enrollment_id" value={item.id} />
          <input
            type="text"
            name="note"
            placeholder="Motivo (opcional)"
            className="h-8 w-40 rounded-lg border border-border bg-surface-container-lowest px-2 text-label-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary"
          />
          <IconButton
            icon="cancel"
            label="Confirmar rechazo"
            tone="danger"
            type="submit"
            name="approve"
            value="false"
            disabled={pending}
          />
          <IconButton icon="close" label="Cancelar" type="button" onClick={() => setNoteOpen(false)} />
        </form>
      ) : (
        <div className="flex items-center gap-1">
          <form action={formAction}>
            <input type="hidden" name="enrollment_id" value={item.id} />
            <input type="hidden" name="approve" value="true" />
            <IconButton icon="check_circle" label="Aprobar" type="submit" disabled={pending} />
          </form>
          <IconButton icon="cancel" label="Rechazar" tone="danger" onClick={() => setNoteOpen(true)} />
        </div>
      )}
      {state?.error && <p className="w-full text-label-xs text-blocked-fg">{state.error}</p>}
    </li>
  );
}

function RosterPanel({
  course,
  roster,
  members,
}: {
  course: Course;
  roster: RosterRow[];
  members: Member[];
}) {
  const enrolledIds = new Set(roster.map((r) => r.person_id));
  const available = members.filter((m) => !enrolledIds.has(m.person_id));
  const [enrollState, enrollAction, enrollPending] = useActionState(enrollMember, undefined);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-headline-sm text-on-surface">Alumnos de {course.name}</h2>
          <p className="text-label-xs text-on-surface-variant">
            {course.enrolled_count}/{course.capacity} cupos
          </p>
        </div>
        <Link href="?" className="text-label-sm text-on-surface-variant hover:text-on-surface">
          Cerrar
        </Link>
      </div>

      {available.length > 0 && (
        <form action={enrollAction} className="flex items-end gap-2">
          <input type="hidden" name="course_id" value={course.id} />
          <Select id="person_id" label="Inscribir socio directamente">
            {available.map((m) => (
              <option key={m.person_id} value={m.person_id}>
                {m.full_name}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={enrollPending} className="mb-0.5">
            {enrollPending ? "Inscribiendo…" : "Inscribir"}
          </Button>
        </form>
      )}
      {enrollState?.error && <Alert tone="error">{enrollState.error}</Alert>}
      {enrollState?.message && <Alert>{enrollState.message}</Alert>}

      {roster.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">Todavía no hay alumnos inscritos.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roster.map((r) => (
            <RosterRowItem key={r.enrollment_id} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

const STATUS_LABELS: Record<RosterRow["status"], string> = {
  pending: "Solicitud pendiente",
  active: "Inscrito",
  pending_cancellation: "Baja solicitada",
  cancelled: "De baja",
};

function RosterRowItem({ row }: { row: RosterRow }) {
  const [state, formAction, pending] = useActionState(removeEnrollment, undefined);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-container-lowest px-3 py-2">
      <div>
        <p className="text-body-md-medium text-on-surface">{row.full_name}</p>
        <p className="text-label-xs text-on-surface-variant">
          {STATUS_LABELS[row.status]}
          {row.review_note && ` · ${row.review_note}`}
        </p>
      </div>
      {row.status !== "cancelled" && (
        <form action={formAction}>
          <input type="hidden" name="enrollment_id" value={row.enrollment_id} />
          <IconButton
            icon="person_remove"
            label="Retirar del curso"
            tone="danger"
            type="submit"
            disabled={pending}
            onClick={(e) => {
              if (!confirm(`¿Retirar a ${row.full_name} del curso?`)) e.preventDefault();
            }}
          />
        </form>
      )}
      {state?.error && <p className="text-label-xs text-blocked-fg">{state.error}</p>}
    </li>
  );
}

function CoursePanel({
  course,
  courts,
  coaches,
  courseRates,
  currency,
  onClose,
}: {
  course: Course | null;
  courts: Court[];
  coaches: Coach[];
  courseRates: CourseRate[];
  currency: string;
  onClose: () => void;
}) {
  const action = course ? updateCourse : createCourse;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [weekdays, setWeekdays] = useState<number[]>([]);

  useEffect(() => {
    if (state?.message) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function toggleWeekday(value: number) {
    setWeekdays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm text-on-surface">
          {course ? "Editar curso" : "Agregar curso"}
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
        {course && <input type="hidden" name="course_id" value={course.id} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="name"
            label="Nombre del Programa"
            defaultValue={state?.fields?.name ?? course?.name ?? ""}
            placeholder="Ej. Clínica de Saque y Volea"
            required
          />
          <Field
            id="level"
            label="Nivel Técnico Requerido"
            defaultValue={state?.fields?.level ?? course?.level ?? ""}
            placeholder="Ej. Intermedio, Infantil/Juvenil…"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="head_coach_id"
            label="Entrenador Titular"
            defaultValue={state?.fields?.head_coach_id ?? course?.head_coach_id ?? ""}
            required
          >
            <option value="">Elige un entrenador</option>
            {coaches.map((c) => (
              <option key={c.person_id} value={c.person_id}>
                {c.full_name}
              </option>
            ))}
          </Select>
          <Select
            id="assistant_coach_id"
            label="Asistente (Opcional)"
            defaultValue={course?.assistant_coach_id ?? ""}
          >
            <option value="">Sin asistente asignado</option>
            {coaches.map((c) => (
              <option key={c.person_id} value={c.person_id}>
                {c.full_name}
              </option>
            ))}
          </Select>
        </div>

        <fieldset disabled={!!course} className="contents">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select id="court_id" label="Cancha" defaultValue={course?.court_id ?? ""} required>
              <option value="">Elige una cancha</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Field
              id="capacity"
              label="Cupo"
              type="number"
              min={1}
              defaultValue={state?.fields?.capacity ?? course?.capacity ?? ""}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="start_date"
              label="Fecha Inicio"
              type="date"
              defaultValue={course?.start_date ?? ""}
              required
            />
            <Field
              id="end_date"
              label="Fecha Fin"
              type="date"
              defaultValue={course?.end_date ?? ""}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="start_time"
              label="Hora Inicio"
              type="time"
              defaultValue={course?.start_time?.slice(0, 5) ?? "09:00"}
              required
            />
            <Field
              id="end_time"
              label="Hora Fin"
              type="time"
              defaultValue={course?.end_time?.slice(0, 5) ?? "10:30"}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label-sm text-on-surface-variant">Días de Entrenamiento en Sede</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeekday(day.value)}
                  className={
                    weekdays.includes(day.value)
                      ? "rounded-lg bg-primary px-3 py-1.5 text-label-sm text-on-primary"
                      : "rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface-variant hover:bg-surface-container"
                  }
                >
                  {day.label}
                </button>
              ))}
            </div>
            {weekdays.map((d) => (
              <input key={d} type="hidden" name="weekdays" value={d} />
            ))}
          </div>
          {course && (
            <p className="text-label-xs text-on-surface-variant">
              Cancha, fechas, horario y días no se pueden editar una vez creado el curso — ya generaron
              las sesiones en el calendario.
            </p>
          )}
        </fieldset>

        <Select
          id="rate_id"
          label="Tarifa Socio"
          defaultValue={course?.rate_id ?? ""}
          hint={
            courseRates.length === 0
              ? "Crea una tarifa con servicio “Curso” en Configuración → Tarifas para fijar un precio."
              : undefined
          }
        >
          <option value="">Sin tarifa (informativo, sin precio)</option>
          {courseRates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} — {formatMoney(r.price_amount, currency)}
            </option>
          ))}
        </Select>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : course ? "Guardar cambios" : "Crear curso"}
          </Button>
        </div>
      </form>
    </section>
  );
}
