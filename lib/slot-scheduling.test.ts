import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  formatLocalTime,
  generateSlots,
  isoWeekday,
  todayInZone,
  zonedTimeToUtcISO,
} from "./slot-scheduling.ts";

describe("isoWeekday", () => {
  it("returns 1 for Monday and 7 for Sunday", () => {
    assert.equal(isoWeekday("2030-02-04"), 1); // a Monday
    assert.equal(isoWeekday("2030-02-10"), 7); // the following Sunday
  });
});

describe("addDays", () => {
  it("moves forward and backward across month and year boundaries", () => {
    assert.equal(addDays("2030-02-04", 1), "2030-02-05");
    assert.equal(addDays("2030-02-28", 1), "2030-03-01");
    assert.equal(addDays("2030-01-01", -1), "2029-12-31");
  });
  it("is a no-op for 0 days", () => {
    assert.equal(addDays("2030-02-04", 0), "2030-02-04");
  });
});

describe("zonedTimeToUtcISO", () => {
  it("converts Bogotá (UTC-05:00, no DST) local time to UTC", () => {
    assert.equal(
      zonedTimeToUtcISO("2030-02-04", "09:00", "America/Bogota"),
      "2030-02-04T14:00:00.000Z",
    );
  });
  it("round-trips through formatLocalTime", () => {
    const utc = zonedTimeToUtcISO("2030-02-04", "15:30", "America/Bogota");
    assert.equal(formatLocalTime(utc, "America/Bogota"), "15:30");
  });
  it("handles a zone with DST (Santiago) on both sides of the transition", () => {
    // These are illustrative, not asserting the exact Chilean DST calendar —
    // just that summer/winter produce different UTC offsets for the same
    // local wall-clock hour.
    const summer = zonedTimeToUtcISO("2030-01-15", "12:00", "America/Santiago");
    const winter = zonedTimeToUtcISO("2030-07-15", "12:00", "America/Santiago");
    assert.notEqual(summer, winter);
  });
});

describe("todayInZone", () => {
  it("returns the UTC calendar date when it matches the zone", () => {
    const now = new Date("2030-02-04T12:00:00Z"); // midday UTC, well inside both calendar days
    assert.equal(todayInZone("America/Bogota", now), "2030-02-04");
  });

  it("stays on the zone's calendar date even when UTC has already rolled over", () => {
    // 02:00 UTC = 21:00 the PREVIOUS day in Bogotá (UTC-05:00) — this is the
    // ~5h window every day where new Date().toISOString().slice(0, 10)
    // disagrees with the club's actual "today".
    const now = new Date("2030-02-04T02:00:00Z");
    assert.equal(todayInZone("America/Bogota", now), "2030-02-03");
  });
});

describe("generateSlots", () => {
  const base = {
    dateISO: "2030-02-04",
    timeZone: "America/Bogota",
    slotMinutes: 60,
    minAdvanceHours: 0,
    now: new Date("2030-01-01T00:00:00Z"),
    existingBookingsUtc: [],
  };

  it("slices the default 06:00–22:00 window into hourly slots", () => {
    const slots = generateSlots(base);
    assert.equal(slots.length, 16); // 06 to 21 inclusive start times
    assert.equal(slots[0].label, "06:00");
    assert.equal(slots.at(-1)?.label, "21:00");
  });

  it("respects a narrower window", () => {
    const slots = generateSlots({
      ...base,
      window: { startTime: "08:00", endTime: "10:00" },
    });
    assert.deepEqual(slots.map((s) => s.label), ["08:00", "09:00"]);
  });

  it("drops slots that overlap an existing booking", () => {
    const slots = generateSlots({
      ...base,
      window: { startTime: "08:00", endTime: "11:00" },
      existingBookingsUtc: [
        {
          startsAtUtc: zonedTimeToUtcISO("2030-02-04", "09:00", "America/Bogota"),
          endsAtUtc: zonedTimeToUtcISO("2030-02-04", "10:00", "America/Bogota"),
        },
      ],
    });
    assert.deepEqual(slots.map((s) => s.label), ["08:00", "10:00"]);
  });

  it("keeps a slot that only touches a booking's boundary, even when the booking's timestamps use PostgREST's '+00:00' format instead of toISOString()'s '.000Z'", () => {
    // Regression test: a slot's own boundaries always come from
    // zonedTimeToUtcISO (Date#toISOString() shape), but existingBookingsUtc
    // in production comes straight from Supabase/PostgREST, which serializes
    // timestamptz as "...+00:00". Comparing those as raw strings instead of
    // instants made a slot that merely touches a booking (no real overlap)
    // register as overlapping, because "+00:00" sorts before ".000Z" in
    // plain string comparison even for the exact same instant.
    const slots = generateSlots({
      ...base,
      window: { startTime: "08:00", endTime: "11:00" },
      existingBookingsUtc: [
        {
          // 10:00-11:00 Bogotá == 15:00-16:00 UTC, in PostgREST's format.
          startsAtUtc: "2030-02-04T15:00:00+00:00",
          endsAtUtc: "2030-02-04T16:00:00+00:00",
        },
      ],
    });
    assert.deepEqual(slots.map((s) => s.label), ["08:00", "09:00"]);
  });

  it("drops slots before the minimum advance window", () => {
    const slots = generateSlots({
      ...base,
      window: { startTime: "08:00", endTime: "12:00" },
      minAdvanceHours: 3,
      now: new Date(zonedTimeToUtcISO("2030-02-04", "07:30", "America/Bogota")),
    });
    // now=07:30 + 3h = earliest 10:30, so 08:00–10:00 fall inside the
    // advance window and only 11:00 clears it.
    assert.deepEqual(slots.map((s) => s.label), ["11:00"]);
  });

  it("never returns a slot narrower than slot_minutes at the window edge", () => {
    const slots = generateSlots({
      ...base,
      slotMinutes: 90,
      window: { startTime: "08:00", endTime: "10:00" },
    });
    // Only one 90-minute slot fits in a 2-hour window starting on the hour.
    assert.deepEqual(slots.map((s) => s.label), ["08:00"]);
  });
});
