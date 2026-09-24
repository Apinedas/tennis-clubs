// Pure precedence logic for "which tarifa applies to this booking" — the
// piece deferred back when Tarifas was built ("cómo se decide qué tarifa
// aplica a una reserva real queda para cuando construyamos Reservas").
//
// A rate can target: a specific court, all courts of a surface, or the
// whole club (court_id/surface both null); a specific service (booking
// type) or every service; a specific category or every category. More
// specific always wins. This is display-only — nothing is charged yet
// (Payments is phase 2) — so "no match" just means "price to confirm",
// never a blocked booking.
//
// Every logged-in student is treated as 'member' for this lookup: there's
// no separate guest/non-member flow for self-service booking, so
// non_member rates are excluded before this function ever sees them.

import type { Database } from "@/lib/database.types";
import { formatLocalTime, isoWeekday } from "./slot-scheduling.ts";

type Rate = Database["public"]["Tables"]["rate"]["Row"];
type BookingType = Database["public"]["Enums"]["booking_type"];

export function selectApplicableRate(
  rates: Rate[],
  opts: {
    courtId: string;
    courtSurface: string;
    service: BookingType;
    startsAtUtc: string;
    endsAtUtc: string;
    timeZone: string;
  },
): Rate | null {
  const weekday = isoWeekday(opts.startsAtUtc.slice(0, 10));
  const startLocal = formatLocalTime(opts.startsAtUtc, opts.timeZone);
  const endLocal = formatLocalTime(opts.endsAtUtc, opts.timeZone);

  const candidates = rates.filter((r) => {
    if (r.category === "non_member") return false;
    if (r.service && r.service !== opts.service) return false;
    if (r.court_id && r.court_id !== opts.courtId) return false;
    if (!r.court_id && r.surface && r.surface !== opts.courtSurface) return false;
    if (!r.weekdays.includes(weekday)) return false;
    return r.start_time.slice(0, 5) <= startLocal && endLocal <= r.end_time.slice(0, 5);
  });

  candidates.sort((a, b) => {
    const specificity = (r: Rate) => (r.court_id ? 0 : r.surface ? 1 : 2);
    const serviceScore = (r: Rate) => (r.service ? 0 : 1);
    const categoryScore = (r: Rate) => (r.category ? 0 : 1);
    return (
      specificity(a) - specificity(b) ||
      serviceScore(a) - serviceScore(b) ||
      categoryScore(a) - categoryScore(b)
    );
  });

  return candidates[0] ?? null;
}
