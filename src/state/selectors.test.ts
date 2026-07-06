import { describe, expect, it } from "vitest";
import { defaultState } from "./storage";
import { addDays, morningPainTrend, yesterdayMorningPain } from "./selectors";
import type { AppState, DayEntry } from "../types";
import { EMPTY_RED_FLAGS } from "../types";

const TODAY = "2026-07-06";
const YESTERDAY = addDays(TODAY, -1);

function morningDay(dateKey: string, dayNumber: number, pain: number): DayEntry {
  return {
    date: dateKey,
    dayNumber,
    morning: { pain, stiffness: 3, worseThanYesterday: false, sleepQuality: 5 },
    redFlags: { ...EMPTY_RED_FLAGS },
    completedTaskIds: [],
    swaps: {},
    workBlocksCompleted: 0,
  };
}

function stateWithDays(days: Record<string, DayEntry>): AppState {
  return { ...defaultState(YESTERDAY), days };
}

describe("yesterdayMorningPain", () => {
  it("returns yesterday's recorded morning pain", () => {
    const state = stateWithDays({ [YESTERDAY]: morningDay(YESTERDAY, 1, 6) });
    expect(yesterdayMorningPain(state, TODAY)).toBe(6);
  });

  it("returns null on a gap day (no entry for yesterday, but earlier days exist)", () => {
    const dayBefore = addDays(YESTERDAY, -1);
    const state = stateWithDays({ [dayBefore]: morningDay(dayBefore, 1, 6) });
    expect(yesterdayMorningPain(state, TODAY)).toBeNull();
  });

  it("returns null on the plan's first day (no prior days at all)", () => {
    const state = stateWithDays({});
    expect(yesterdayMorningPain(state, TODAY)).toBeNull();
  });

  it("returns null when yesterday has an entry but no morning check-in", () => {
    const state = stateWithDays({
      [YESTERDAY]: {
        date: YESTERDAY,
        dayNumber: 1,
        redFlags: { ...EMPTY_RED_FLAGS },
        completedTaskIds: [],
        swaps: {},
        workBlocksCompleted: 0,
      },
    });
    expect(yesterdayMorningPain(state, TODAY)).toBeNull();
  });

  it("never reaches further back than one day", () => {
    const twoDaysAgo = addDays(YESTERDAY, -1);
    const state = stateWithDays({ [twoDaysAgo]: morningDay(twoDaysAgo, 1, 9) });
    // Yesterday itself has nothing recorded, so this must stay null even
    // though an earlier day has a value — reaching back would misrepresent
    // the comparison as "vs yesterday".
    expect(yesterdayMorningPain(state, TODAY)).toBeNull();
  });
});

describe("morningPainTrend", () => {
  it("is 'down' when today's pain is lower than yesterday's", () => {
    const state = stateWithDays({
      [YESTERDAY]: morningDay(YESTERDAY, 1, 6),
      [TODAY]: morningDay(TODAY, 2, 3),
    });
    expect(morningPainTrend(state, TODAY)).toEqual({ direction: "down", yesterday: 6, today: 3 });
  });

  it("is 'up' when today's pain is higher than yesterday's", () => {
    const state = stateWithDays({
      [YESTERDAY]: morningDay(YESTERDAY, 1, 3),
      [TODAY]: morningDay(TODAY, 2, 5),
    });
    expect(morningPainTrend(state, TODAY)).toEqual({ direction: "up", yesterday: 3, today: 5 });
  });

  it("is 'same' when today's pain equals yesterday's", () => {
    const state = stateWithDays({
      [YESTERDAY]: morningDay(YESTERDAY, 1, 4),
      [TODAY]: morningDay(TODAY, 2, 4),
    });
    expect(morningPainTrend(state, TODAY)).toEqual({ direction: "same", yesterday: 4, today: 4 });
  });

  it("is null on a gap day (yesterday has no morning check-in)", () => {
    const state = stateWithDays({ [TODAY]: morningDay(TODAY, 2, 4) });
    expect(morningPainTrend(state, TODAY)).toBeNull();
  });

  it("is null on the plan's first day (no days recorded yet)", () => {
    const state = stateWithDays({});
    expect(morningPainTrend(state, TODAY)).toBeNull();
  });

  it("is null before today's own morning check-in is recorded", () => {
    const state = stateWithDays({ [YESTERDAY]: morningDay(YESTERDAY, 1, 6) });
    expect(morningPainTrend(state, TODAY)).toBeNull();
  });
});
