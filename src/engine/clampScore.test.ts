import { describe, expect, it } from "vitest";
import { clampScore } from "./clampScore";

describe("clampScore", () => {
  it("passes integers 0-10 through unchanged", () => {
    for (let n = 0; n <= 10; n++) expect(clampScore(n)).toBe(n);
  });

  it("rounds fractional values to the nearest integer", () => {
    expect(clampScore(3.4)).toBe(3);
    expect(clampScore(3.5)).toBe(4);
    expect(clampScore(7.49)).toBe(7);
    expect(clampScore(7.5)).toBe(8);
  });

  it("clamps values below 0 up to 0", () => {
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(-0.5)).toBe(0);
    expect(clampScore(-1000)).toBe(0);
  });

  it("clamps values above 10 down to 10", () => {
    expect(clampScore(11)).toBe(10);
    expect(clampScore(10.5)).toBe(10); // rounds to 11, then clamps to 10
    expect(clampScore(1000)).toBe(10);
  });

  it("treats NaN as the most conservative reading (0), not a propagated NaN", () => {
    expect(clampScore(NaN)).toBe(0);
    expect(Number.isNaN(clampScore(NaN))).toBe(false);
  });
});
