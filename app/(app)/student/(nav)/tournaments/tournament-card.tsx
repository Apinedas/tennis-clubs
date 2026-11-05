"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { requestTournamentEntry } from "@/app/actions/tournaments";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type Tournament = Database["public"]["Functions"]["list_club_tournaments"]["Returns"][number];

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "application/pdf"]);
const EXTENSIONS = new Set(["png", "jpg", "jpeg", "pdf"]);

export function TournamentCard({
  tournament,
  formatLabel,
  myEntry,
  clubId,
  personId,
  currency,
}: {
  tournament: Tournament;
  formatLabel: string;
  myEntry: { id: string; status: "pending" | "active" | "cancelled" } | null;
  clubId: string;
  personId: string;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(requestTournamentEntry, undefined);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requiresProof = tournament.price_amount != null && tournament.price_amount > 0;

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
    formData.set("tournament_id", tournament.id);

    if (file) {
      setUploading(true);
      try {
        const supabase = createClient();
        const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const folder = `${clubId}/${personId}/tournament-${tournament.id}`;
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

    formAction(formData);
  }

  const busy = pending || uploading;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm">
      <div>
        <h3 className="text-headline-sm font-bold text-on-surface">{tournament.name}</h3>
        <p className="text-label-xs text-on-surface-variant">
          {formatLabel}
          {tournament.category ? ` · ${tournament.category}` : ""}
        </p>
      </div>
      <p className="text-label-sm text-on-surface-variant">{tournament.entry_count} inscritos</p>

      {myEntry ? (
        <span
          className={
            myEntry.status === "active"
              ? "inline-flex w-fit items-center rounded-md border border-available-border bg-available-bg px-2 py-0.5 text-label-xs text-available-fg"
              : "inline-flex w-fit items-center rounded-md border border-border bg-surface-container px-2 py-0.5 text-label-xs text-on-surface-variant"
          }
        >
          {myEntry.status === "active" ? "Inscrito" : "Solicitud pendiente"}
        </span>
      ) : tournament.registration_open ? (
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
            disabled={busy}
            className="rounded-lg px-4 py-2.5 text-center text-body-md-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {busy
              ? "Enviando…"
              : requiresProof
                ? `Inscribirme (${formatMoney(tournament.price_amount, currency)})`
                : "Inscribirme"}
          </button>
          {fileError && <span className="text-label-xs text-blocked-fg">{fileError}</span>}
          {state?.error && <span className="text-label-xs text-blocked-fg">{state.error}</span>}
          {state?.message && <span className="text-label-xs text-available-fg">{state.message}</span>}
        </form>
      ) : (
        <span className="text-label-xs text-on-surface-variant">Inscripciones cerradas</span>
      )}

      {tournament.bracket_generated && (
        <Link href={`?tournament=${tournament.id}`} className="text-label-sm text-primary hover:underline">
          Ver cuadro →
        </Link>
      )}
    </div>
  );
}
