"use client";

import { useActionState, useRef, useState } from "react";
import { requestEnrollment, requestUnenroll } from "@/app/actions/courses";
import { createClient } from "@/lib/supabase/client";
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

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "application/pdf"]);
const EXTENSIONS = new Set(["png", "jpg", "jpeg", "pdf"]);

export function CourseActions({
  courseId,
  price,
  currency,
  spotsLeft,
  enrollment,
  clubId,
  personId,
}: {
  courseId: string;
  price: number | null;
  currency: string;
  spotsLeft: number;
  enrollment: Enrollment;
  clubId: string;
  personId: string;
}) {
  const [enrollState, enrollAction, enrollPending] = useActionState(requestEnrollment, undefined);
  const [leaveState, leaveAction, leavePending] = useActionState(requestUnenroll, undefined);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requiresProof = price != null && price > 0;

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

  function pickFile(f: File) {
    setFileError(null);
    const extension = f.name.split(".").pop()?.toLowerCase() ?? "";
    const validType = f.type ? TYPES.has(f.type) : EXTENSIONS.has(extension);
    if (!validType) {
      setFileError("Usa PNG, JPG o PDF.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError("El archivo pesa más de 5MB.");
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (requiresProof && !file) {
      setFileError("Sube tu comprobante de pago para inscribirte.");
      return;
    }

    const formData = new FormData();
    formData.set("course_id", courseId);

    if (file) {
      setUploading(true);
      try {
        const supabase = createClient();
        const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const folder = `${clubId}/${personId}/course-${courseId}`;
        const path = `${folder}/comprobante.${extension}`;

        const { data: existing } = await supabase.storage.from("payment-proofs").list(folder);
        if (existing?.length) {
          await supabase.storage.from("payment-proofs").remove(existing.map((f2) => `${folder}/${f2.name}`));
        }

        const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file);
        if (uploadError) throw uploadError;

        formData.set("payment_proof_path", path);
      } catch {
        setFileError("No pudimos subir el comprobante. Intenta de nuevo.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    enrollAction(formData);
  }

  const busy = enrollPending || uploading;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      {requiresProof && (
        <label className="flex h-9 w-fit cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface-container-lowest px-3 text-label-sm text-on-surface shadow-sm hover:bg-surface-container">
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            upload_file
          </span>
          {file ? file.name : "Adjuntar comprobante"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
            }}
          />
        </label>
      )}
      <button
        type="submit"
        disabled={busy || spotsLeft <= 0}
        className="rounded-lg px-4 py-2.5 text-center text-body-md-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {busy
          ? "Enviando…"
          : spotsLeft <= 0
            ? "Sin cupo"
            : price != null
              ? `Inscribirme al Curso (${formatMoney(price, currency)})`
              : "Inscribirme al Curso"}
      </button>
      {fileError && <span className="text-label-xs text-blocked-fg">{fileError}</span>}
      {enrollState?.error && <span className="text-label-xs text-blocked-fg">{enrollState.error}</span>}
      {enrollState?.message && <span className="text-label-xs text-available-fg">{enrollState.message}</span>}
    </form>
  );
}
