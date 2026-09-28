import { requireArea } from "@/lib/auth/dal";
import { SERVICE_LABELS } from "@/lib/labels";
import { formatLocalTime } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import { ApprovePaymentButton, RejectPaymentButton } from "./payment-review-actions";

export const metadata = { title: "Pagos · Academia de Tenis" };

const SIGNED_URL_TTL_SECONDS = 300;

export default async function AdminPaymentsPage() {
  const session = await requireArea("admin");
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const [{ data: pending }, { data: club }] = await Promise.all([
    supabase.rpc("list_pending_payments", { p_club: clubId }),
    supabase.from("club").select("timezone").eq("id", clubId).single(),
  ]);
  const timeZone = club?.timezone ?? "America/Bogota";

  const items = await Promise.all(
    (pending ?? []).map(async (item) => {
      let proofUrl: string | null = null;
      if (item.payment_proof_path) {
        const { data } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(item.payment_proof_path, SIGNED_URL_TTL_SECONDS);
        proofUrl = data?.signedUrl ?? null;
      }
      return { ...item, proofUrl };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Pagos</h1>
        <p className="text-body-md text-on-surface-variant">
          Comprobantes pendientes de revisión.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          No hay comprobantes pendientes de revisión.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm"
            >
              <div>
                <p className="text-body-md-medium text-on-surface">
                  {item.person_name ?? item.guest_name ?? "Invitado"}
                </p>
                <p className="text-label-xs text-on-surface-variant">
                  {item.court_name} · {item.type ? SERVICE_LABELS[item.type] : ""} ·{" "}
                  {new Date(item.starts_at).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  · {formatLocalTime(item.starts_at, timeZone)}–{formatLocalTime(item.ends_at, timeZone)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {item.proofUrl ? (
                  <a
                    href={item.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-label-sm text-primary hover:underline"
                  >
                    Ver comprobante
                  </a>
                ) : (
                  <span className="text-label-xs text-on-surface-variant">Sin comprobante</span>
                )}
                <ApprovePaymentButton bookingId={item.id} />
                <RejectPaymentButton bookingId={item.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
