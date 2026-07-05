import { describe, expect, it } from "vitest";
import { dayEntriesToCsv, escapeCsvField } from "./csv";
import { EMPTY_RED_FLAGS } from "../types";
import type { DayEntry } from "../types";

const HEADER =
  "date,day,morning_pain,stiffness,sleep_quality,worse_than_yesterday,current_pain,abdominal_pressure," +
  "worst_spike,post_exercise_pain_increase,pain_elevated_after_1h,symptoms_spread,sitting_tolerance_min," +
  "standing_tolerance_min,walking_tolerance_min,walking_done_min,heat_used,work_blocks,no_twist_pledge," +
  "tasks_completed,decision,notes";

function emptyDay(overrides: Partial<DayEntry> = {}): DayEntry {
  return {
    date: "2026-07-05",
    dayNumber: 1,
    redFlags: { ...EMPTY_RED_FLAGS },
    completedTaskIds: [],
    swaps: {},
    workBlocksCompleted: 0,
    ...overrides,
  };
}

describe("dayEntriesToCsv", () => {
  it("emits the exact header row", () => {
    const csv = dayEntriesToCsv([]);
    expect(csv.split("\n")[0]).toBe(HEADER);
  });

  it("returns just the header line for an empty entries array", () => {
    expect(dayEntriesToCsv([])).toBe(HEADER + "\n");
  });

  it("serializes a full day with correct values, yes/no booleans, and task count", () => {
    const day = emptyDay({
      date: "2026-07-05",
      dayNumber: 3,
      morning: { pain: 4, stiffness: 6, worseThanYesterday: true, sleepQuality: 7 },
      current: { pain: 3, abdomenPressure: 2 },
      evening: {
        worstSpike: 5,
        postExercisePainIncrease: 1,
        painStillElevatedAfterOneHour: false,
        symptomsSpread: true,
        sittingToleranceMinutes: 45,
        standingToleranceMinutes: 20,
        walkingToleranceMinutes: 15,
        walkingMinutesCompleted: 10,
        heatUsed: true,
        notes: "felt okay",
      },
      completedTaskIds: ["a", "b", "c"],
      workBlocksCompleted: 4,
      noTwistPledgeKept: true,
      decision: "ADVANCE",
    });
    const csv = dayEntriesToCsv([day]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe(
      "2026-07-05,3,4,6,7,yes,3,2,5,1,no,yes,45,20,15,10,yes,4,yes,3,ADVANCE,felt okay"
    );
  });

  it("yields empty fields (not 'undefined') for a sparse day with no morning/current/evening", () => {
    const day = emptyDay({ date: "2026-07-06", dayNumber: 2 });
    const csv = dayEntriesToCsv([day]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe("2026-07-06,2,,,,,,,,,,,,,,,,0,,0,,");
    expect(csv).not.toContain("undefined");
  });

  it("escapes a comma via escapeCsvField", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("escapes a double quote via escapeCsvField by doubling it and wrapping in quotes", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("leaves plain text untouched", () => {
    expect(escapeCsvField("plain text")).toBe("plain text");
  });

  it("round-trips notes containing commas, quotes, and newlines with correct escaping", () => {
    const day = emptyDay({
      date: "2026-07-07",
      dayNumber: 4,
      evening: {
        worstSpike: 2,
        postExercisePainIncrease: 0,
        painStillElevatedAfterOneHour: false,
        symptomsSpread: false,
        sittingToleranceMinutes: 30,
        standingToleranceMinutes: 10,
        walkingToleranceMinutes: 5,
        walkingMinutesCompleted: 5,
        heatUsed: false,
        notes: 'Pain, spiked "badly"\nafter walk',
      },
    });
    const csv = dayEntriesToCsv([day]);
    const lines = csv.split("\n");
    // The notes field is the last column; escaping wraps it in quotes, doubles
    // internal quotes, and keeps the embedded newline inside the quoted field
    // (so the CSV "row" spans two physical lines here).
    expect(lines[1]).toBe(
      '2026-07-07,4,,,,,,,2,0,no,no,30,10,5,5,no,0,,0,,"Pain, spiked ""badly""'
    );
    expect(lines[2]).toBe('after walk"');
  });
});
