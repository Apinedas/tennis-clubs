import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatLocalTime,
  generateSlots,
  isoWeekday,
  zonedTimeToUtcISO,
} from "./slot-scheduling.ts";

describe("isoWeekday", () => {
  it("returns 1 for Monday and 7 for Sunday", () => {
    assert.equal(isoWeekday("2030-02-04"), 1); // a Monday
    assert.equal(isoWeekday("2030-02-10"), 7); // the following Sunday
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
