import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MODULES, moduleLabel } from "./modules.ts";

describe("MODULES", () => {
  it("covers exactly the columns club_module_name allows", () => {
    assert.deepEqual(
      MODULES.map((m) => m.value).sort(),
      ["bookings", "courses", "dynamic_pricing", "lessons", "tournaments"],
    );
  });
  it("every module has a non-empty label and description", () => {
    for (const m of MODULES) {
      assert.ok(m.label.length > 0, m.value);
      assert.ok(m.description.length > 0, m.value);
    }
  });
});

describe("moduleLabel", () => {
  it("returns the Spanish label for a known module", () => {
    assert.equal(moduleLabel("bookings"), "Reservas de canchas");
  });
});
