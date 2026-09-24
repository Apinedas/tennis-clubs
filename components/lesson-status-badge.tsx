import type { Database } from "@/lib/database.types";

type Status = Database["public"]["Enums"]["booking_status"];

const STYLES: Record<Status, string> = {
  confirmed: "border-available-border bg-available-bg text-available-fg",
  pending: "border-blocked-border bg-blocked-bg text-blocked-fg",
  cancelled: "border-cancelled-border bg-cancelled-bg text-cancelled-fg line-through",
  blocked: "border-blocked-border bg-blocked-bg text-blocked-fg",
};

const LABELS: Record<Status, string> = {
  confirmed: "Confirmada",
  pending: "Pendiente",
  cancelled: "Cancelada",
  blocked: "Bloqueada",
};

export function LessonStatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-label-xs ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
