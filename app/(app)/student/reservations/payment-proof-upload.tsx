"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "application/pdf"]);
const EXTENSIONS = new Set(["png", "jpg", "jpeg", "pdf"]);

export function PaymentProofUpload({
  bookingId,
  clubId,
}: {
  bookingId: string;
  clubId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const validType = file.type ? TYPES.has(file.type) : EXTENSIONS.has(extension);
    if (!validType) {
      setError("Usa PNG, JPG o PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("El archivo pesa más de 5MB.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const folder = `${clubId}/${bookingId}`;
      const path = `${folder}/comprobante.${extension || "pdf"}`;

      // Single file per booking: drop whatever was there before (same
      // pattern as the club logo) so a re-upload never orphans old proof.
      const { data: existing } = await supabase.storage.from("payment-proofs").list(folder);
      if (existing?.length) {
        await supabase.storage
          .from("payment-proofs")
          .remove(existing.map((f) => `${folder}/${f.name}`));
      }

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { error: rpcError } = await supabase.rpc("submit_payment_proof", {
        p_id: bookingId,
        p_path: path,
      });
      if (rpcError) throw rpcError;

      router.refresh();
    } catch {
      setError("No pudimos subir el comprobante. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex h-9 w-fit cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface-container-lowest px-3 text-label-sm text-on-surface shadow-sm hover:bg-surface-container">
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          upload_file
        </span>
        {busy ? "Subiendo…" : "Subir comprobante"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,application/pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </label>
      {error && <span className="max-w-[200px] text-right text-label-xs text-blocked-fg">{error}</span>}
    </div>
  );
}
