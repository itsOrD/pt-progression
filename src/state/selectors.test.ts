import { describe, expect, it } from "vitest";
import { buildInsightsInput } from "./selectors";
import { pearson } from "../engine/insights";
import { EMPTY_RED_FLAGS, type AppState, type DayEntry, type EveningReview, type MorningCheckin } from "../types";

function baseDay(date: string, dayNumber: number, overrides: Partial<DayEntry> = {}): DayEntry {
  return {
    date,
    dayNumber,
    redFlags: { ...EMPTY_RED_FLAGS },
    completedTaskIds: [],
    swaps: {},
    workBlocksCompleted: 0,
    ...overrides,
  };
}

function evening(overrides: Partial<EveningReview> = {}): EveningReview {
  return {
    worstSpike: 0,
    postExercisePainIncrease: 0,
    painStillElevatedAfterOneHour: false,
    symptomsSpread: false,
    sittingToleranceMinutes: 30,
    standingToleranceMinutes: 15,
    walkingToleranceMinutes: 20,
    walkingMinutesCompleted: 0,
    heatUsed: false,
    notes: "",
    ...overrides,
  };
}

function morning(overrides: Partial<MorningCheckin> = {}): MorningCheckin {
  return {
    pain: 0,
    stiffness: 0,
    worseThanYesterday: false,
    sleepQuality: 0,
    ...overrides,
  };
}

function makeState(days: DayEntry[]): AppState {
  const record: Record<string, DayEntry> = {};
  for (const d of days) record[d.date] = d;
  return {
    version: 1,
    startDate: days[0]?.date ?? "2024-01-01",
    phaseOverride: null,
    days: record,
    badges: {},
    extension: null,
    graduatedOn: null,
    timer: { mode: "idle", endsAt: null, blocksCompletedTotal: 0 },
    settings: { vibration: true, sound: false },
    lastSavedAt: null,
  };
}

describe("buildInsightsInput — walkingVsNextMorning pairing", () => {
  it("pairs walking with the very next calendar day when it exists (control case)", () => {
    const day1 = baseDay("2024-06-01", 1, { evening: evening({ walkingMinutesCompleted: 45 }) });
    const day2 = baseDay("2024-06-02", 2, { morning: morning({ pain: 7 }) });
    const state = makeState([day1, day2]);

    const input = buildInsightsInput(state, "2024-06-02");

    expect(input.walkingVsNextMorning).toEqual([{ x: 45, y: 7 }]);
  });

  it("does not pair walking with morning pain across a gap day (a missing day breaks the pair)", () => {
    const day1 = baseDay("2024-06-01", 1, { evening: evening({ walkingMinutesCompleted: 45 }) });
    // 2024-06-02 intentionally has no entry at all — a gap day.
    const day3 = baseDay("2024-06-03", 3, { morning: morning({ pain: 7 }) });
    const state = makeState([day1, day3]);

    const input = buildInsightsInput(state, "2024-06-03");

    expect(input.walkingVsNextMorning).toHaveLength(0);
    expect(input.walkingVsNextMorning).not.toContainEqual({ x: 45, y: 7 });
  });
});

describe("buildInsightsInput — sleepVsPain prefers current.pain", () => {
  it("uses current.pain over morning.pain when a day has both", () => {
    const sleepQuality = [1, 2, 3, 4, 5];
    // Chosen so the two possible readings disagree in direction:
    // morning.pain trends opposite to sleepQuality (would give r = -1 if used),
    // current.pain trends with sleepQuality (gives r = +1 since that's what's actually used).
    const morningPain = [5, 4, 3, 2, 1];
    const currentPain = [1, 2, 3, 4, 5];

    const days = sleepQuality.map((sq, i) =>
      baseDay(`2024-07-0${i + 1}`, i + 1, {
        morning: morning({ pain: morningPain[i], sleepQuality: sq }),
        current: { pain: currentPain[i], abdomenPressure: 0 },
      })
    );
    const state = makeState(days);

    const input = buildInsightsInput(state, "2024-07-05");

    expect(input.sleepVsPain).toHaveLength(5);
    expect(input.sleepVsPain.map((p) => p.y)).toEqual(currentPain);
    expect(input.sleepVsPain.map((p) => p.y)).not.toEqual(morningPain);
    expect(pearson(input.sleepVsPain)).toBeCloseTo(1, 10);
  });

  it("falls back to morning.pain when a day has no current check-in", () => {
    const sleepQuality = [1, 2, 3, 4, 5];
    const morningPain = [1, 2, 3, 4, 5];

    const days = sleepQuality.map((sq, i) =>
      baseDay(`2024-08-0${i + 1}`, i + 1, {
        morning: morning({ pain: morningPain[i], sleepQuality: sq }),
      })
    );
    const state = makeState(days);

    const input = buildInsightsInput(state, "2024-08-05");

    expect(input.sleepVsPain.map((p) => p.y)).toEqual(morningPain);
  });
});
