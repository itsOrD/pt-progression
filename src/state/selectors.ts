import type { AppState, DayEntry, Decision, EveningReview } from "../types";
import { EMPTY_RED_FLAGS } from "../types";
import {
  activeRedFlags,
  decide,
  evaluatePlanStatus,
  formalHelpReasons,
  type DecisionInput,
  type DecisionResult,
  type GraduationInput,
  type PlanStatus,
  type PlanStatusInput,
} from "../engine/decision";
import { adjustPlan, completionPct } from "../engine/adjust";
import { recoveryScore, type RecoveryScore, type ScoreInput } from "../engine/score";
import { phaseForDay } from "../data/plan";
import type { AdjustedPlan } from "../types";

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return toDateKey(dt);
}

export function dayNumberFor(dateKey: string, startDate: string): number {
  const [y1, m1, d1] = startDate.split("-").map(Number);
  const [y2, m2, d2] = dateKey.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

export function emptyDay(dateKey: string, dayNumber: number): DayEntry {
  return {
    date: dateKey,
    dayNumber,
    redFlags: { ...EMPTY_RED_FLAGS },
    completedTaskIds: [],
    swaps: {},
    workBlocksCompleted: 0,
  };
}

export function getDay(state: AppState, dateKey: string): DayEntry {
  return state.days[dateKey] ?? emptyDay(dateKey, dayNumberFor(dateKey, state.startDate));
}

/**
 * Sensible starting values for a first-time evening review, seeded from the
 * day's own check-ins where available. Shared by DailyView (today) and
 * DayEditor (past days) so "start an evening review" behaves identically
 * regardless of which day is being filled in.
 */
export function defaultEveningFor(day: DayEntry): EveningReview {
  return {
    worstSpike: day.current?.pain ?? day.morning?.pain ?? 3,
    postExercisePainIncrease: 0,
    painStillElevatedAfterOneHour: false,
    symptomsSpread: false,
    sittingToleranceMinutes: 30,
    standingToleranceMinutes: 15,
    walkingToleranceMinutes: 15,
    walkingMinutesCompleted: 0,
    heatUsed: false,
    notes: "",
  };
}

export function sortedDayEntries(state: AppState): DayEntry[] {
  return Object.values(state.days).sort((a, b) => a.date.localeCompare(b.date));
}

/** Days strictly before the given date, sorted oldest → newest. */
function daysBefore(state: AppState, dateKey: string): DayEntry[] {
  return sortedDayEntries(state).filter((d) => d.date < dateKey);
}

export function nextMorningWorse(state: AppState, dateKey: string): boolean {
  // "Worse than yesterday" recorded on the following morning applies back to
  // the previous day's decision. For today's decision we use today's morning
  // check-in ("worse than yesterday") as the next-morning signal for yesterday's load.
  const day = state.days[dateKey];
  return day?.morning?.worseThanYesterday ?? false;
}

export function buildDecisionInput(state: AppState, dateKey: string): DecisionInput {
  const day = getDay(state, dateKey);
  const prior = daysBefore(state, dateKey);
  const window = [...prior.slice(-2), day];
  const plan = phaseForDay(day.dayNumber, state.phaseOverride);
  const taskIds = plan.tasks.map((t) => t.taskId);

  return {
    dayNumber: day.dayNumber,
    redFlags: day.redFlags,
    morningPain: day.morning?.pain ?? null,
    currentPain: day.current?.pain ?? day.morning?.pain ?? null,
    worstSpike: day.evening?.worstSpike ?? null,
    abdomenPressure: day.current?.abdomenPressure ?? null,
    completionPct: day.evening ? completionPct(taskIds, day.completedTaskIds) : 100, // completion only judged at evening review
    postExercisePainIncrease: day.evening?.postExercisePainIncrease ?? null,
    painStillElevatedAfterOneHour: day.evening?.painStillElevatedAfterOneHour ?? false,
    nextMorningWorse: nextMorningWorse(state, dateKey),
    symptomsSpread: day.evening?.symptomsSpread ?? false,
    sittingToleranceHistory: window.map((d) => d.evening?.sittingToleranceMinutes ?? null),
    standingToleranceHistory: window.map((d) => d.evening?.standingToleranceMinutes ?? null),
  };
}

export function decisionFor(state: AppState, dateKey: string): DecisionResult {
  return decide(buildDecisionInput(state, dateKey));
}

/**
 * Editing a past day's check-ins can change its own stored decision — and
 * the decision engine also looks back up to 2 prior days for sitting/
 * standing tolerance trends, so later days' stored decisions can go stale
 * too. Walk forward from the edited date, oldest → newest, threading the
 * updated state through each step so later days see the corrected data.
 */
export function recomputeDecisions(state: AppState, fromDate: string): AppState {
  const affectedDates = sortedDayEntries(state)
    .filter((d) => d.date >= fromDate)
    .map((d) => d.date);
  return affectedDates.reduce((s, date) => {
    const day = getDay(s, date);
    const hasCheckin = !!(day.morning || day.current || day.evening);
    const decision = hasCheckin ? decisionFor(s, date).decision : undefined;
    if (day.decision === decision) return s;
    return { ...s, days: { ...s.days, [date]: { ...day, decision } } };
  }, state);
}

export function greenStreak(state: AppState, throughDate: string): number {
  const entries = sortedDayEntries(state).filter((d) => d.date <= throughDate);
  let streak = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const decision = entries[i].date === throughDate ? decisionFor(state, entries[i].date).decision : entries[i].decision;
    if (decision === "ADVANCE" || decision === "GRADUATE") streak++;
    else break;
  }
  return streak;
}

export function decisionHistory(state: AppState): { date: string; dayNumber: number; decision: Decision }[] {
  return sortedDayEntries(state)
    .filter((d) => d.decision)
    .map((d) => ({ date: d.date, dayNumber: d.dayNumber, decision: d.decision! }));
}

function latest<T>(entries: DayEntry[], pick: (d: DayEntry) => T | null | undefined): T | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const v = pick(entries[i]);
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

function earliest<T>(entries: DayEntry[], pick: (d: DayEntry) => T | null | undefined): T | null {
  for (const e of entries) {
    const v = pick(e);
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

export function buildGraduationInput(state: AppState, dateKey: string): GraduationInput {
  const day = getDay(state, dateKey);
  const entries = sortedDayEntries(state).filter((d) => d.date <= dateKey);
  return {
    dayNumber: day.dayNumber,
    greenStreak: greenStreak(state, dateKey),
    currentPain: day.current?.pain ?? day.morning?.pain ?? latest(entries, (d) => d.current?.pain),
    worstSpike: day.evening?.worstSpike ?? latest(entries, (d) => d.evening?.worstSpike),
    abdomenPressure: day.current?.abdomenPressure ?? latest(entries, (d) => d.current?.abdomenPressure),
    sittingToleranceMinutes: latest(entries, (d) => d.evening?.sittingToleranceMinutes),
    walkingToleranceMinutes: latest(entries, (d) => d.evening?.walkingToleranceMinutes),
    redFlagsActive: activeRedFlags(day.redFlags).length > 0,
    symptomsSpread: entries.slice(-2).some((d) => d.evening?.symptomsSpread),
    nextMorningWorse: nextMorningWorse(state, dateKey),
  };
}

export function buildPlanStatusInput(state: AppState, dateKey: string): PlanStatusInput {
  const entries = sortedDayEntries(state).filter((d) => d.date <= dateKey);
  const day = getDay(state, dateKey);
  const recent = entries.slice(-3);
  const strengthPcts = recent.map((d) => {
    const plan = phaseForDay(d.dayNumber, state.phaseOverride);
    const strengthIds = plan.tasks.filter((t) => t.group === "strength").map((t) => t.taskId);
    return strengthIds.length ? completionPct(strengthIds, d.completedTaskIds) : 100;
  });
  const lastDecided = [...entries].reverse().find((d) => d.decision);
  return {
    dayNumber: day.dayNumber,
    graduation: buildGraduationInput(state, dateKey),
    lastDecision: lastDecided?.decision ?? null,
    firstPain: earliest(entries, (d) => d.morning?.pain ?? d.current?.pain),
    recentPain: latest(entries, (d) => d.current?.pain ?? d.morning?.pain),
    recentSpikes: recent.map((d) => d.evening?.worstSpike ?? null),
    recentAbdomen: recent.map((d) => d.current?.abdomenPressure ?? null),
    symptomsSpreadRecently: recent.some((d) => d.evening?.symptomsSpread),
    backOffCount: entries.filter((d) => d.decision === "BACK_OFF").length,
    walkingToleranceMinutes: latest(entries, (d) => d.evening?.walkingToleranceMinutes),
    sittingToleranceMinutes: latest(entries, (d) => d.evening?.sittingToleranceMinutes),
    strengthCompletionPct: strengthPcts.length
      ? strengthPcts.reduce((a, b) => a + b, 0) / strengthPcts.length
      : 100,
  };
}

export function planStatusFor(state: AppState, dateKey: string): PlanStatus {
  return evaluatePlanStatus(buildPlanStatusInput(state, dateKey));
}

export function buildScoreInput(state: AppState, dateKey: string): ScoreInput {
  const entries = sortedDayEntries(state).filter((d) => d.date <= dateKey);
  const recent = entries.slice(-3);
  const completions = entries.map((d) => {
    const plan = phaseForDay(d.dayNumber, state.phaseOverride);
    return completionPct(plan.tasks.map((t) => t.taskId), d.completedTaskIds);
  });
  const psInput = buildPlanStatusInput(state, dateKey);
  const day = getDay(state, dateKey);
  return {
    firstPain: earliest(entries, (d) => d.morning?.pain ?? d.current?.pain),
    recentPain: latest(entries, (d) => d.current?.pain ?? d.morning?.pain),
    firstSpike: earliest(entries, (d) => d.evening?.worstSpike),
    recentSpike: latest(entries, (d) => d.evening?.worstSpike),
    firstAbdomen: earliest(entries, (d) => d.current?.abdomenPressure),
    recentAbdomen: latest(entries, (d) => d.current?.abdomenPressure),
    walkingToleranceMinutes: latest(entries, (d) => d.evening?.walkingToleranceMinutes),
    sittingToleranceMinutes: latest(entries, (d) => d.evening?.sittingToleranceMinutes),
    avgCompletionPct: completions.length
      ? completions.reduce((a, b) => a + b, 0) / completions.length
      : 0,
    symptomsSpreadRecently: recent.some((d) => d.evening?.symptomsSpread),
    nextMorningWorseRecently: recent.some((d) => d.morning?.worseThanYesterday),
    formalHelpRecommended:
      day.dayNumber >= 10 && formalHelpReasons(psInput).length >= 2,
  };
}

export function scoreFor(state: AppState, dateKey: string): RecoveryScore {
  return recoveryScore(buildScoreInput(state, dateKey));
}

export function adjustedPlanFor(state: AppState, dateKey: string): AdjustedPlan {
  const day = getDay(state, dateKey);
  const decision = decisionFor(state, dateKey).decision;
  const phase = phaseForDay(day.dayNumber, state.phaseOverride);
  return adjustPlan(phase, decision, day.swaps, day.evening?.symptomsSpread ?? false);
}

export function basePlanFor(state: AppState, dateKey: string): AdjustedPlan {
  const day = getDay(state, dateKey);
  const phase = phaseForDay(day.dayNumber, state.phaseOverride);
  return adjustPlan(phase, "EXTEND", day.swaps, false); // EXTEND → default doses, nothing dropped
}

// ------------------------------------------------------------------- badges

export function evaluateBadges(state: AppState, dateKey: string): string[] {
  const earned: string[] = [];
  const has = (id: string) => id in state.badges || earned.includes(id);
  const entries = sortedDayEntries(state);
  const day = getDay(state, dateKey);
  const anyCheckin = entries.some((d) => d.morning || d.current || d.evening);
  const decision = decisionFor(state, dateKey).decision;
  const celebratory = decision !== "GET_CHECKED";

  if (!has("first-checkin") && anyCheckin) earned.push("first-checkin");
  if (!has("heat-helped") && entries.some((d) => d.evening?.heatUsed || d.completedTaskIds.some((t) => t.includes("heat"))))
    earned.push("heat-helped");
  if (!celebratory) return earned; // never reward past the red-flag gate

  if (
    !has("walked-before-work") &&
    entries.some(
      (d) =>
        d.workBlocksCompleted > 0 &&
        (d.evening?.walkingMinutesCompleted ?? 0) > 0
    )
  )
    earned.push("walked-before-work");
  if (!has("desk-timer-streak") && entries.some((d) => d.workBlocksCompleted >= 4))
    earned.push("desk-timer-streak");
  if (!has("no-twist-workday") && entries.some((d) => d.noTwistPledgeKept && d.workBlocksCompleted >= 2))
    earned.push("no-twist-workday");

  const plan = adjustedPlanFor(state, dateKey);
  const movementIds = plan.tasks.filter((t) => t.group === "movement").map((t) => t.taskId);
  const strengthIds = plan.tasks.filter((t) => t.group === "strength").map((t) => t.taskId);
  if (!has("mobility-minimum") && movementIds.length > 0 && movementIds.every((t) => day.completedTaskIds.includes(t)))
    earned.push("mobility-minimum");
  if (!has("core-primer") && strengthIds.length > 0 && strengthIds.every((t) => day.completedTaskIds.includes(t)))
    earned.push("core-primer");

  const streak = greenStreak(state, dateKey);
  if (!has("two-green-days") && streak >= 2) earned.push("two-green-days");
  if (!has("three-green-days") && streak >= 3) earned.push("three-green-days");

  if (!has("smart-back-off") && entries.some((d) => d.decision === "BACK_OFF" && (d.completedTaskIds.length > 0 || d.evening)))
    earned.push("smart-back-off");
  if (!has("symptom-detective") && entries.filter((d) => (d.evening?.notes ?? "").trim().length >= 10).length >= 3)
    earned.push("symptom-detective");

  const grad = planStatusFor(state, dateKey);
  if (!has("maintenance-ready") && grad.kind === "graduate") earned.push("maintenance-ready");

  return earned;
}

export function checkinStreak(state: AppState, todayKey: string): number {
  let streak = 0;
  let cursor = todayKey;
  // Count consecutive days (ending today or yesterday) with any check-in.
  const hasCheckin = (k: string) => {
    const d = state.days[k];
    return !!(d && (d.morning || d.current || d.evening));
  };
  if (!hasCheckin(cursor)) cursor = addDays(cursor, -1);
  while (hasCheckin(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
