import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initials } from "./initials.ts";

describe("initials", () => {
  it("takes the first letter of the first and last word", () => {
    assert.equal(initials("Ana Alumna"), "AA");
    assert.equal(initials("Carlos Andrés Mendoza"), "CM");
  });
  it("falls back to the first two letters for a single word", () => {
    assert.equal(initials("Cher"), "CH");
  });
  it("handles extra whitespace", () => {
    assert.equal(initials("  Ana   Alumna  "), "AA");
  });
  it("returns an empty string for an empty name", () => {
    assert.equal(initials(""), "");
    assert.equal(initials("   "), "");
  });
});
