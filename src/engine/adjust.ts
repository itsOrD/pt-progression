import type {
  AdjustedPlan,
  AdjustedTask,
  Decision,
  DoseLevel,
  Exercise,
  Phase,
} from "../types";
import { EXERCISES, getExercise } from "../data/exercises";

const IRRITABILITY_RANK = { low: 0, medium: 1, higher: 2 } as const;

export function doseLevelFor(decision: Decision): DoseLevel {
  switch (decision) {
    case "GET_CHECKED":
    case "BACK_OFF":
      return "regress";
    case "HOLD":
      return "min";
    case "DO_MINIMUM":
      return "min";
    case "ADVANCE":
    case "GRADUATE":
      return "progress";
    case "EXTEND":
      return "default";
  }
}

export function planNote(decision: Decision): string {
  switch (decision) {
    case "GET_CHECKED":
      return "Everything except gentle relief is paused. Getting checked comes first.";
    case "BACK_OFF":
      return "Scaled back to relief, desk breaks, and flare-safe movement at regressed doses.";
    case "HOLD":
      return "Same plan, minimum doses. No progression today.";
    case "DO_MINIMUM":
      return "Core tasks only, minimum doses — a light day still counts.";
    case "ADVANCE":
    case "GRADUATE":
      return "Green day — progressed doses where available.";
    case "EXTEND":
      return "Standard doses.";
  }
}

export function doseFor(ex: Exercise, level: DoseLevel): string {
  switch (level) {
    case "regress":
      return ex.regressDose;
    case "min":
      return ex.minDose;
    case "default":
      return ex.defaultDose;
    case "progress":
      return ex.progressDose;
  }
}

/**
 * Build today's prescription from the phase plan and the current decision.
 * Pure: no storage access.
 */
export function adjustPlan(
  phase: Phase,
  decision: Decision,
  swaps: Record<string, string>,
  symptomsSpread: boolean
): AdjustedPlan {
  const level = doseLevelFor(decision);
  const dropped: string[] = [];
  const tasks: AdjustedTask[] = [];

  for (const task of phase.tasks) {
    const exId = swaps[task.taskId] ?? task.exerciseId;
    const ex = getExercise(exId);

    if (decision === "GET_CHECKED") {
      // Only gentle relief while waiting on care.
      if (ex.element !== "relief" || !ex.safeWhenFlared) {
        dropped.push(task.taskId);
        continue;
      }
    } else if (decision === "BACK_OFF") {
      // Relief + desk breaks + only flare-safe movement.
      const keep =
        ex.element === "relief" ||
        ex.element === "desk-reset" ||
        (ex.safeWhenFlared === true && ex.irritability === "low");
      if (!keep) {
        dropped.push(task.taskId);
        continue;
      }
    } else if (decision === "DO_MINIMUM") {
      if (!task.core) {
        dropped.push(task.taskId);
        continue;
      }
    } else if (decision === "HOLD") {
      // Keep the plan but drop the highest-irritability items.
      if (ex.irritability === "higher" || (ex.avoidIfSpreading && symptomsSpread)) {
        dropped.push(task.taskId);
        continue;
      }
    }

    if (symptomsSpread && ex.avoidIfSpreading) {
      dropped.push(task.taskId);
      continue;
    }

    tasks.push({ ...task, exerciseId: exId, dose: doseFor(ex, level), doseLevel: level });
  }

  const note = planNote(decision);

  return { phase, decision, tasks, droppedTaskIds: dropped, note };
}

/**
 * Swap candidates: same element; equal-or-lower irritability when the day is
 * restrictive (Hold/Back Off/Get Checked/Do Minimum), same or slightly higher
 * difficulty when green.
 */
export function swapCandidates(
  exerciseId: string,
  decision: Decision,
  excludeIds: string[] = []
): Exercise[] {
  const current = getExercise(exerciseId);
  const restrictive =
    decision === "HOLD" || decision === "BACK_OFF" || decision === "GET_CHECKED" || decision === "DO_MINIMUM";

  const preferred = current.substitutions
    .map((id) => EXERCISES[id])
    .filter((ex): ex is Exercise => !!ex);
  const sameElement = Object.values(EXERCISES).filter(
    (ex) => ex.element === current.element && ex.id !== current.id
  );

  const pool = [...preferred, ...sameElement.filter((ex) => !preferred.some((p) => p.id === ex.id))];

  return pool.filter((ex) => {
    if (ex.id === current.id || excludeIds.includes(ex.id)) return false;
    if (restrictive) {
      return IRRITABILITY_RANK[ex.irritability] <= IRRITABILITY_RANK[current.irritability];
    }
    // Green: same or slightly higher difficulty (and not wildly easier picks excluded — allow easier too).
    return ex.difficulty <= current.difficulty + 1;
  });
}

export function completionPct(taskIds: string[], completed: string[]): number {
  if (taskIds.length === 0) return 0;
  const done = taskIds.filter((t) => completed.includes(t)).length;
  return (done / taskIds.length) * 100;
}
