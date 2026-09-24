import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectApplicableRate } from "./rate-matching.ts";
import { zonedTimeToUtcISO } from "./slot-scheduling.ts";

type Rate = Parameters<typeof selectApplicableRate>[0][number];

function rate(overrides: Partial<Rate>): Rate {
  return {
    id: "id",
    club_id: "club",
    court_id: null,
    name: "rate",
    category: null,
    service: null,
    surface: null,
    start_time: "06:00:00",
    end_time: "22:00:00",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    price_amount: 0,
    active: true,
    ...overrides,
  };
}

const MONDAY = "2030-02-04"; // isoWeekday = 1
const opts = {
  courtId: "court-1",
  courtSurface: "clay",
  service: "singles" as const,
  startsAtUtc: zonedTimeToUtcISO(MONDAY, "09:00", "America/Bogota"),
  endsAtUtc: zonedTimeToUtcISO(MONDAY, "10:00", "America/Bogota"),
  timeZone: "America/Bogota",
};

describe("selectApplicableRate", () => {
  it("returns null when nothing matches", () => {
    assert.equal(selectApplicableRate([], opts), null);
  });

  it("matches a club-wide rate with no other candidates", () => {
    const clubWide = rate({ id: "club-wide", price_amount: 45000 });
    assert.equal(selectApplicableRate([clubWide], opts)?.id, "club-wide");
  });

  it("prefers a court-specific rate over a surface-wide one", () => {
    const surfaceWide = rate({ id: "surface", surface: "clay", price_amount: 40000 });
    const courtSpecific = rate({ id: "court", court_id: "court-1", price_amount: 50000 });
    assert.equal(
      selectApplicableRate([surfaceWide, courtSpecific], opts)?.id,
      "court",
    );
  });

  it("prefers a surface-wide rate over a club-wide one", () => {
    const clubWide = rate({ id: "club-wide" });
    const surfaceWide = rate({ id: "surface", surface: "clay" });
    assert.equal(
      selectApplicableRate([clubWide, surfaceWide], opts)?.id,
      "surface",
    );
  });

  it("ignores a rate for a different court", () => {
    const other = rate({ court_id: "court-2" });
    assert.equal(selectApplicableRate([other], opts), null);
  });

  it("ignores a rate for a different surface", () => {
    const other = rate({ surface: "hard" });
    assert.equal(selectApplicableRate([other], opts), null);
  });

  it("ignores a rate for a different service", () => {
    const lessonOnly = rate({ service: "lesson" });
    assert.equal(selectApplicableRate([lessonOnly], opts), null);
  });

  it("prefers a service-specific rate over a service-agnostic one", () => {
    const generic = rate({ id: "generic" });
    const singlesOnly = rate({ id: "singles", service: "singles" });
    assert.equal(selectApplicableRate([generic, singlesOnly], opts)?.id, "singles");
  });

  it("ignores a rate outside the requested weekday", () => {
    const sundayOnly = rate({ weekdays: [7] });
    assert.equal(selectApplicableRate([sundayOnly], opts), null);
  });

  it("ignores a rate whose time window doesn't fully contain the slot", () => {
    const tooNarrow = rate({ start_time: "09:30:00", end_time: "17:00:00" });
    assert.equal(selectApplicableRate([tooNarrow], opts), null);
  });

  it("prefers a category-specific rate over category-agnostic", () => {
    const generic = rate({ id: "generic" });
    const memberRate = rate({ id: "member", category: "member" });
    assert.equal(selectApplicableRate([generic, memberRate], opts)?.id, "member");
  });

  it("never matches a non_member-only rate (students are treated as members)", () => {
    const nonMember = rate({ category: "non_member" });
    assert.equal(selectApplicableRate([nonMember], opts), null);
  });
});
