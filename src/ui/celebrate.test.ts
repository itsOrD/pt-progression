import { describe, expect, it } from "vitest";
import { enteredDone, leftDone } from "./celebrate";

describe("enteredDone", () => {
  it("is true only when a task transitions from unchecked to checked", () => {
    expect(enteredDone(false, true)).toBe(true);
  });

  it("is false when the task was already done (covers initial mount)", () => {
    expect(enteredDone(true, true)).toBe(false);
  });

  it("is false when unchecking", () => {
    expect(enteredDone(true, false)).toBe(false);
  });

  it("is false when it stays unchecked", () => {
    expect(enteredDone(false, false)).toBe(false);
  });
});

describe("leftDone", () => {
  it("is true only when a task transitions from checked to unchecked", () => {
    expect(leftDone(true, false)).toBe(true);
  });

  it("is false in every other transition", () => {
    expect(leftDone(false, true)).toBe(false);
    expect(leftDone(true, true)).toBe(false);
    expect(leftDone(false, false)).toBe(false);
  });
});
