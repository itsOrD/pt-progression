import { describe, expect, it } from "vitest";
import type { AppState, DayEntry } from "../types";
import { EMPTY_RED_FLAGS } from "../types";
import { decisionFor, recomputeDecisions } from "./selectors";

function baseState(days: Record<string, DayEntry>): AppState {
  return {
    version: 1,
    startDate: "2026-01-01",
    phaseOverride: null,
    days,
    badges: {},
    extension: null,
    graduatedOn: null,
    timer: { mode: "idle", endsAt: null, blocksCompletedTotal: 0 },
    settings: { vibration: true, sound: false },
    lastSavedAt: null,
  };
}

function day(overrides: Partial<DayEntry> & { date: string; dayNumber: number }): DayEntry {
  return {
    redFlags: { ...EMPTY_RED_FLAGS },
    completedTaskIds: [],
    swaps: {},
    workBlocksCompleted: 0,
    ...overrides,
  };
}

describe("recomputeDecisions", () => {
  it("flips a stale BACK_OFF to the correct decision once pain is corrected", () => {
    const d = day({
      date: "2026-01-01",
      dayNumber: 1,
      morning: { pain: 2, stiffness: 2, worseThanYesterday: false, sleepQuality: 7 },
      current: { pain: 2, abdomenPressure: 0 }, // corrected from a mislogged 7
      decision: "BACK_OFF", // stale snapshot from before the correction
    });
    const state = baseState({ [d.date]: d });

    const result = recomputeDecisions(state, "2026-01-01");

    expect(result.days["2026-01-01"].decision).not.toBe("BACK_OFF");
    expect(result.days["2026-01-01"].decision).toBe(decisionFor(result, "2026-01-01").decision);
  });

  it("cascades a correction on one day into a later day's stored decision", () => {
    // Day 3's HOLD is driven by a flat 2-day sitting-tolerance trend that
    // includes day 1's value. Lowering day 1's value (as if fixing a
    // mislogged entry) should break the "flat" pattern and let day 3 advance,
    // even though nothing on day 3 itself changed.
    const green = { pain: 2, abdomenPressure: 1 };
    const allPhase1Tasks = [
      "p1-heat",
      "p1-breathing",
      "p1-9090",
      "p1-walk",
      "p1-tilts",
      "p1-catcow",
      "p1-brace",
      "p1-glute",
      "p1-timer",
      "p1-recenter",
      "p1-swivel",
    ];

    const day1 = day({
      date: "2026-01-01",
      dayNumber: 1,
      morning: { pain: 2, stiffness: 2, worseThanYesterday: false, sleepQuality: 7 },
      current: green,
      evening: {
        worstSpike: 2,
        postExercisePainIncrease: 0,
        painStillElevatedAfterOneHour: false,
        symptomsSpread: false,
        sittingToleranceMinutes: 40, // will be edited down to 10
        standingToleranceMinutes: 10,
        walkingToleranceMinutes: 15,
        walkingMinutesCompleted: 15,
        heatUsed: false,
        notes: "",
      },
    });
    const day2 = day({
      date: "2026-01-02",
      dayNumber: 2,
      morning: { pain: 2, stiffness: 2, worseThanYesterday: false, sleepQuality: 7 },
      current: green,
      evening: {
        worstSpike: 2,
        postExercisePainIncrease: 0,
        painStillElevatedAfterOneHour: false,
        symptomsSpread: false,
        sittingToleranceMinutes: 35,
        standingToleranceMinutes: 15,
        walkingToleranceMinutes: 15,
        walkingMinutesCompleted: 15,
        heatUsed: false,
        notes: "",
      },
    });
    const day3 = day({
      date: "2026-01-03",
      dayNumber: 3,
      morning: { pain: 2, stiffness: 2, worseThanYesterday: false, sleepQuality: 7 },
      current: green,
      completedTaskIds: [...allPhase1Tasks], // 100% completion so completion isn't the gating factor
      evening: {
        worstSpike: 2,
        postExercisePainIncrease: 0,
        painStillElevatedAfterOneHour: false,
        symptomsSpread: false,
        sittingToleranceMinutes: 38, // <= day1(40) and day2(35) <= day1(40) → "flat"
        standingToleranceMinutes: 20,
        walkingToleranceMinutes: 15,
        walkingMinutesCompleted: 15,
        heatUsed: false,
        notes: "",
      },
    });

    const before = baseState({ [day1.date]: day1, [day2.date]: day2, [day3.date]: day3 });
    const beforeRecomputed = recomputeDecisions(before, "2026-01-01");
    expect(beforeRecomputed.days["2026-01-03"].decision).toBe("HOLD");

    // Correct day 1's sitting tolerance (as if a mislogged value was fixed).
    const corrected: AppState = {
      ...before,
      days: {
        ...before.days,
        [day1.date]: {
          ...day1,
          evening: { ...day1.evening!, sittingToleranceMinutes: 10 },
        },
      },
    };
    const after = recomputeDecisions(corrected, "2026-01-01");

    expect(after.days["2026-01-03"].decision).toBe("ADVANCE");
  });

  it("leaves days with no check-in data undecided", () => {
    const empty = day({ date: "2026-01-01", dayNumber: 1 });
    const state = baseState({ [empty.date]: empty });

    const result = recomputeDecisions(state, "2026-01-01");

    expect(result.days["2026-01-01"].decision).toBeUndefined();
  });
});
