import { describe, expect, it } from "vitest";
import { defaultState } from "./storage";
import { addDays, emptyDay, recentDecisionCounts, RECENT_DECISION_WINDOW } from "./selectors";
import type { AppState, Decision } from "../types";

const START = "2026-01-01";

/** Builds an AppState with one day per array entry, oldest first. `null` means
 * the day was never scored (no decision snapshot) — it should be skipped. */
function stateWithDecisions(decisions: (Decision | null)[]): AppState {
  const state = defaultState(START);
  decisions.forEach((decision, i) => {
    const date = addDays(START, i);
    const day = { ...emptyDay(date, i + 1) };
    if (decision) day.decision = decision;
    state.days[date] = day;
  });
  return state;
}

describe("recentDecisionCounts", () => {
  it("counts every decision when fewer than the window size are logged", () => {
    const state = stateWithDecisions(["HOLD", "HOLD", "ADVANCE"]);
    const counts = recentDecisionCounts(state);
    expect(counts.HOLD).toBe(2);
    expect(counts.ADVANCE).toBe(1);
    expect(counts.BACK_OFF).toBe(0);
    expect(counts.GET_CHECKED).toBe(0);
    expect(counts.DO_MINIMUM).toBe(0);
  });

  it("counts every decision when exactly the window size are logged", () => {
    const decisions: Decision[] = Array.from({ length: RECENT_DECISION_WINDOW }, (_, i) =>
      i % 2 === 0 ? "HOLD" : "ADVANCE"
    );
    const state = stateWithDecisions(decisions);
    const counts = recentDecisionCounts(state);
    expect(counts.HOLD + counts.ADVANCE).toBe(RECENT_DECISION_WINDOW);
    expect(counts.HOLD).toBe(Math.ceil(RECENT_DECISION_WINDOW / 2));
    expect(counts.ADVANCE).toBe(Math.floor(RECENT_DECISION_WINDOW / 2));
  });

  it("only counts the most recent window when more days are logged, dropping the oldest", () => {
    // 12 logged days: the oldest 2 (BACK_OFF) fall outside the last-10 window.
    const decisions: Decision[] = [
      "BACK_OFF",
      "BACK_OFF",
      ...Array.from({ length: 10 }, () => "HOLD" as Decision),
    ];
    const state = stateWithDecisions(decisions);
    const counts = recentDecisionCounts(state);
    expect(counts.HOLD).toBe(10);
    expect(counts.BACK_OFF).toBe(0);
  });

  it("skips days without a decision snapshot so the window still reaches 10 logged days", () => {
    // 11 days total, one (index 1) never got a decision. The window should
    // count the 10 that *were* logged, reaching one calendar day further back
    // than a naive "last 10 days" count would.
    const decisions: (Decision | null)[] = [
      "GET_CHECKED",
      null,
      "HOLD",
      "HOLD",
      "HOLD",
      "ADVANCE",
      "ADVANCE",
      "ADVANCE",
      "ADVANCE",
      "DO_MINIMUM",
      "DO_MINIMUM",
    ];
    const state = stateWithDecisions(decisions);
    const counts = recentDecisionCounts(state);
    expect(counts.GET_CHECKED).toBe(1);
    expect(counts.HOLD).toBe(3);
    expect(counts.ADVANCE).toBe(4);
    expect(counts.DO_MINIMUM).toBe(2);
  });

  it("respects a custom limit", () => {
    const state = stateWithDecisions(["HOLD", "HOLD", "ADVANCE", "ADVANCE", "ADVANCE"]);
    const counts = recentDecisionCounts(state, 2);
    expect(counts.ADVANCE).toBe(2);
    expect(counts.HOLD).toBe(0);
  });

  it("returns all-zero counts with no logged history", () => {
    const state = defaultState(START);
    const counts = recentDecisionCounts(state);
    expect(Object.values(counts).every((c) => c === 0)).toBe(true);
  });
});
