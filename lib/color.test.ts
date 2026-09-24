import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { darken } from "./color.ts";

describe("darken", () => {
  it("scales each channel down by the given factor", () => {
    assert.equal(darken("#1b7f4f", 0.85), "#176c43");
  });
  it("clamps to 00 instead of going negative", () => {
    assert.equal(darken("#000000", 0.85), "#000000");
  });
  it("returns the input unchanged for a non-hex string", () => {
    assert.equal(darken("not-a-color"), "not-a-color");
  });
});
