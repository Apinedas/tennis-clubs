"use client";

import { useActionState } from "react";
import { requestEnrollment, requestUnenroll } from "@/app/actions/courses";
import { formatMoney } from "@/lib/labels";

type Enrollment = {
  id: string;
  status: "pending" | "active" | "pending_cancellation" | "cancelled";
  review_note: string | null;
} | null;

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  pending: { label: "Solicitud pendiente", tone: "border-border bg-surface-container text-on-surface-variant" },
  active: { label: "Inscrito", tone: "border-available-border bg-available-bg text-available-fg" },
  pending_cancellation: { label: "Baja solicitada", tone: "border-border bg-surface-container text-on-surface-variant" },
};

export function CourseActions({
  courseId,
  price,
  currency,
  spotsLeft,
  enrollment,
}: {
  courseId: string;
  price: number | null;
  currency: string;
  spotsLeft: number;
  enrollment: Enrollment;
}) {
  const [enrollState, enrollAction, enrollPending] = useActionState(requestEnrollment, undefined);
  const [leaveState, leaveAction, leavePending] = useActionState(requestUnenroll, undefined);

  if (enrollment && enrollment.status !== "cancelled") {
    const copy = STATUS_COPY[enrollment.status];
    return (
      <div className="flex flex-col gap-1.5">
        <span className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-label-xs ${copy.tone}`}>
          {copy.label}
        </span>
        {enrollment.status === "pending" && enrollment.review_note && (
          <span className="text-label-xs text-blocked-fg">{enrollment.review_note}</span>
        )}
        {enrollment.status === "active" && (
          <form action={leaveAction}>
            <input type="hidden" name="enrollment_id" value={enrollment.id} />
            <button
              type="submit"
              disabled={leavePending}
              onClick={(e) => {
                if (!confirm("¿Solicitar la baja de este curso?")) e.preventDefault();
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-label-sm text-blocked-fg hover:bg-blocked-bg disabled:opacity-60"
            >
              {leavePending ? "Enviando…" : "Darme de baja"}
            </button>
          </form>
        )}
        {leaveState?.error && <span className="text-label-xs text-blocked-fg">{leaveState.error}</span>}
      </div>
    );
  }

  return (
    <form action={enrollAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="course_id" value={courseId} />
      <button
        type="submit"
        disabled={enrollPending || spotsLeft <= 0}
        className="rounded-lg px-4 py-2.5 text-center text-body-md-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {enrollPending
          ? "Enviando…"
          : spotsLeft <= 0
            ? "Sin cupo"
            : price != null
              ? `Inscribirme al Curso (${formatMoney(price, currency)})`
              : "Inscribirme al Curso"}
      </button>
      {enrollState?.error && <span className="text-label-xs text-blocked-fg">{enrollState.error}</span>}
      {enrollState?.message && <span className="text-label-xs text-available-fg">{enrollState.message}</span>}
    </form>
  );
}
