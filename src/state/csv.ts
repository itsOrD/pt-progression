import type { DayEntry } from "../types";

const HEADER = [
  "date",
  "day",
  "morning_pain",
  "stiffness",
  "sleep_quality",
  "worse_than_yesterday",
  "current_pain",
  "abdominal_pressure",
  "worst_spike",
  "post_exercise_pain_increase",
  "pain_elevated_after_1h",
  "symptoms_spread",
  "sitting_tolerance_min",
  "standing_tolerance_min",
  "walking_tolerance_min",
  "walking_done_min",
  "heat_used",
  "work_blocks",
  "no_twist_pledge",
  "tasks_completed",
  "decision",
  "notes",
];

/** Wrap a field in double quotes (doubling internal quotes) if it needs CSV escaping. */
export function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function yesNo(v: boolean | undefined): string {
  return v === undefined ? "" : v ? "yes" : "no";
}

function num(v: number | undefined): string {
  return v === undefined ? "" : String(v);
}

export function dayEntriesToCsv(entries: DayEntry[]): string {
  const rows = [HEADER];
  for (const d of entries) {
    rows.push([
      d.date,
      String(d.dayNumber),
      num(d.morning?.pain),
      num(d.morning?.stiffness),
      num(d.morning?.sleepQuality),
      yesNo(d.morning?.worseThanYesterday),
      num(d.current?.pain),
      num(d.current?.abdomenPressure),
      num(d.evening?.worstSpike),
      num(d.evening?.postExercisePainIncrease),
      yesNo(d.evening?.painStillElevatedAfterOneHour),
      yesNo(d.evening?.symptomsSpread),
      num(d.evening?.sittingToleranceMinutes),
      num(d.evening?.standingToleranceMinutes),
      num(d.evening?.walkingToleranceMinutes),
      num(d.evening?.walkingMinutesCompleted),
      yesNo(d.evening?.heatUsed),
      String(d.workBlocksCompleted),
      yesNo(d.noTwistPledgeKept),
      String(d.completedTaskIds.length),
      d.decision ?? "",
      d.evening?.notes ?? "",
    ]);
  }
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n") + "\n";
}
