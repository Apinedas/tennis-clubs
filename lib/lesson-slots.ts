// Pure scheduling math for the lesson-request flow: no DB, no framework —
// easy to unit test, and the one place timezone conversion happens.
//
// Availability is intentionally not tied to a per-coach calendar or to a
// specific rate window (neither exists yet): every day offers the same
// broad operating-hours window, sliced into slot_minutes blocks, minus
// whatever the coach already has booked. Price is looked up separately
// (best effort, for display only) once a slot and a court are chosen.

export const DEFAULT_OPERATING_HOURS = { startTime: "06:00", endTime: "22:00" };

export type TimeWindow = { startTime: string; endTime: string }; // "HH:MM"

export type Slot = {
  startsAtUtc: string;
  endsAtUtc: string;
  /** Local "HH:MM" in the club's timezone, for display. */
  label: string;
};

export type ExistingBooking = { startsAtUtc: string; endsAtUtc: string };

// The calendar weekday of a plain date, as ISO (1=Monday..7=Sunday),
// independent of any timezone — it's a property of the date itself.
export function isoWeekday(dateISO: string): number {
  const day = new Date(`${dateISO}T12:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return day === 0 ? 7 : day;
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// How far ahead of UTC the given zone is, in minutes, at this instant
// (handles DST: evaluated at the instant itself, not a fixed offset).
function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - date.getTime()) / 60_000;
}

// A wall-clock local time on a given date, in an IANA zone, as a UTC ISO
// instant. Standard "guess, measure the offset, correct" conversion.
export function zonedTimeToUtcISO(
  dateISO: string,
  hhmm: string,
  timeZone: string,
): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guessUtc = Date.UTC(y, m - 1, d, hh, mm);
  const offset = timeZoneOffsetMinutes(new Date(guessUtc), timeZone);
  return new Date(guessUtc - offset * 60_000).toISOString();
}

export function formatLocalTime(utcISO: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(utcISO));
}

export function generateLessonSlots(opts: {
  dateISO: string;
  timeZone: string;
  slotMinutes: number;
  minAdvanceHours: number;
  now: Date;
  existingBookingsUtc: ExistingBooking[];
  window?: TimeWindow;
}): Slot[] {
  const window = opts.window ?? DEFAULT_OPERATING_HOURS;
  const earliest = new Date(opts.now.getTime() + opts.minAdvanceHours * 3_600_000);
  const slots: Slot[] = [];

  let cursor = window.startTime;
  while (true) {
    const end = addMinutes(cursor, opts.slotMinutes);
    if (end > window.endTime) break; // zero-padded HH:MM compares lexically
    const startsAtUtc = zonedTimeToUtcISO(opts.dateISO, cursor, opts.timeZone);
    const endsAtUtc = zonedTimeToUtcISO(opts.dateISO, end, opts.timeZone);

    if (new Date(startsAtUtc) >= earliest) {
      const overlaps = opts.existingBookingsUtc.some(
        (b) => startsAtUtc < b.endsAtUtc && b.startsAtUtc < endsAtUtc,
      );
      if (!overlaps) slots.push({ startsAtUtc, endsAtUtc, label: cursor });
    }
    cursor = end;
  }

  return slots;
}
