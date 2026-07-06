import { describe, expect, it } from "vitest";
import { defaultState } from "./storage";
import { buildClinicianReportData, redFlagDays } from "./selectors";
import { EMPTY_RED_FLAGS } from "../types";
import type { AppState, DayEntry } from "../types";

function day(overrides: Partial<DayEntry> & { date: string; dayNumber: number }): DayEntry {
  return {
    redFlags: { ...EMPTY_RED_FLAGS },
    completedTaskIds: [],
    swaps: {},
    workBlocksCompleted: 0,
    ...overrides,
  };
}

function stateWithDays(days: DayEntry[]): AppState {
  const base = defaultState("2026-01-01");
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  return { ...base, days: byDate };
}

describe("redFlagDays", () => {
  it("returns nothing when no red flags were ever reported", () => {
    const state = stateWithDays([
      day({ date: "2026-01-01", dayNumber: 1 }),
      day({ date: "2026-01-02", dayNumber: 2 }),
    ]);
    expect(redFlagDays(state)).toEqual([]);
  });

  it("lists only the days with an active red flag, oldest first, with labels", () => {
    const state = stateWithDays([
      day({ date: "2026-01-01", dayNumber: 1 }),
      day({
        date: "2026-01-02",
        dayNumber: 2,
        redFlags: { ...EMPTY_RED_FLAGS, saddleNumbness: true, feverChills: true },
      }),
      day({ date: "2026-01-03", dayNumber: 3 }),
      day({
        date: "2026-01-04",
        dayNumber: 4,
        redFlags: { ...EMPTY_RED_FLAGS, legWeakness: true },
      }),
    ]);
    const flagged = redFlagDays(state);
    expect(flagged).toHaveLength(2);
    expect(flagged[0]).toEqual({
      date: "2026-01-02",
      dayNumber: 2,
      flags: ["Saddle or groin numbness", "Fever or chills"],
    });
    expect(flagged[1]).toEqual({
      date: "2026-01-04",
      dayNumber: 4,
      flags: ["New leg weakness"],
    });
  });
});

describe("buildClinicianReportData", () => {
  it("builds an empty-but-valid report when there is no data yet", () => {
    const state = stateWithDays([]);
    const data = buildClinicianReportData(state, "2026-01-01");
    expect(data.dayCount).toBe(0);
    expect(data.rows).toEqual([]);
    expect(data.redFlagDays).toEqual([]);
    expect(data.trends).toHaveLength(3);
    for (const t of data.trends) {
      expect(t.first).toBeNull();
      expect(t.latest).toBeNull();
    }
  });

  it("builds the decision-history rows in date order", () => {
    const state = stateWithDays([
      day({
        date: "2026-01-02",
        dayNumber: 2,
        morning: { pain: 4, stiffness: 3, worseThanYesterday: false, sleepQuality: 6 },
        evening: {
          worstSpike: 5,
          postExercisePainIncrease: 0,
          painStillElevatedAfterOneHour: false,
          symptomsSpread: false,
          sittingToleranceMinutes: 40,
          standingToleranceMinutes: 20,
          walkingToleranceMinutes: 15,
          walkingMinutesCompleted: 12,
          heatUsed: true,
          notes: "",
        },
        decision: "HOLD",
      }),
      day({
        date: "2026-01-01",
        dayNumber: 1,
        morning: { pain: 7, stiffness: 6, worseThanYesterday: false, sleepQuality: 4 },
        evening: {
          worstSpike: 8,
          postExercisePainIncrease: 0,
          painStillElevatedAfterOneHour: false,
          symptomsSpread: false,
          sittingToleranceMinutes: 20,
          standingToleranceMinutes: 10,
          walkingToleranceMinutes: 5,
          walkingMinutesCompleted: 5,
          heatUsed: true,
          notes: "",
        },
        decision: "BACK_OFF",
      }),
    ]);
    const data = buildClinicianReportData(state, "2026-01-02");
    expect(data.dayCount).toBe(2);
    expect(data.rows.map((r) => r.date)).toEqual(["2026-01-01", "2026-01-02"]);
    expect(data.rows[0]).toEqual({
      date: "2026-01-01",
      dayNumber: 1,
      morningPain: 7,
      worstSpike: 8,
      decision: "BACK_OFF",
    });
    expect(data.rows[1].decision).toBe("HOLD");
  });

  it("computes first-vs-latest trends across logged days", () => {
    const state = stateWithDays([
      day({
        date: "2026-01-01",
        dayNumber: 1,
        morning: { pain: 7, stiffness: 6, worseThanYesterday: false, sleepQuality: 4 },
        evening: {
          worstSpike: 8,
          postExercisePainIncrease: 0,
          painStillElevatedAfterOneHour: false,
          symptomsSpread: false,
          sittingToleranceMinutes: 20,
          standingToleranceMinutes: 10,
          walkingToleranceMinutes: 5,
          walkingMinutesCompleted: 5,
          heatUsed: true,
          notes: "",
        },
      }),
      day({
        date: "2026-01-05",
        dayNumber: 5,
        morning: { pain: 2, stiffness: 1, worseThanYesterday: false, sleepQuality: 8 },
        evening: {
          worstSpike: 3,
          postExercisePainIncrease: 0,
          painStillElevatedAfterOneHour: false,
          symptomsSpread: false,
          sittingToleranceMinutes: 70,
          standingToleranceMinutes: 40,
          walkingToleranceMinutes: 25,
          walkingMinutesCompleted: 22,
          heatUsed: false,
          notes: "",
        },
      }),
    ]);
    const data = buildClinicianReportData(state, "2026-01-05");
    const byLabel = Object.fromEntries(data.trends.map((t) => [t.label, t]));
    expect(byLabel["Morning pain (0-10)"]).toMatchObject({ first: 7, latest: 2 });
    expect(byLabel["Sitting tolerance"]).toMatchObject({ first: 20, latest: 70 });
    expect(byLabel["Walking minutes"]).toMatchObject({ first: 5, latest: 22 });
  });

  it("surfaces red flag days and graduation status alongside the report", () => {
    const state = stateWithDays([
      day({
        date: "2026-01-01",
        dayNumber: 1,
        redFlags: { ...EMPTY_RED_FLAGS, bladderBowelChange: true },
      }),
    ]);
    const data = buildClinicianReportData(state, "2026-01-01");
    expect(data.redFlagDays).toEqual([
      { date: "2026-01-01", dayNumber: 1, flags: ["Bladder or bowel control change"] },
    ]);
    expect(data.phaseNumber).toBe(1);
    expect(data.planStatus.kind).toBe("continue");
    expect(data.graduatedOn).toBeNull();
  });
});
