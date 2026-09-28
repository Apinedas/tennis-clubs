import type { Database } from "@/lib/database.types";

type PaymentStatus = Database["public"]["Enums"]["payment_status"];

const STYLES: Record<PaymentStatus, string> = {
  unpaid: "border-blocked-border bg-blocked-bg text-blocked-fg",
  pending_review: "border-border bg-surface-container text-on-surface-variant",
  paid: "border-available-border bg-available-bg text-available-fg",
};

const LABELS: Record<PaymentStatus, string> = {
  unpaid: "Pendiente de pago",
  pending_review: "En revisión",
  paid: "Pagado",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-label-xs ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
