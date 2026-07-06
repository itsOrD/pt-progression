import type { GraduationResult } from "./decision";

export type ForecastPoint = { day: number; value: number };

export type ForecastDirection = "atMost" | "atLeast";

export type CriterionForecast = {
  label: string;
  met: boolean;
  current: number | null;
  target: number;
  direction: ForecastDirection;
  projectedDay: number | null;
  /** True once this criterion has 3+ points of its own history — enough to fit a trend line. */
  hasEnoughData: boolean;
};

export type ForecastInput = {
  dayNumber: number;
  graduation: GraduationResult;
  painHistory: ForecastPoint[];
  spikeHistory: ForecastPoint[];
  sittingHistory: ForecastPoint[];
  walkingHistory: ForecastPoint[];
};

export type ForecastResult = {
  criteria: CriterionForecast[];
  metCount: number;
  totalCount: number;
  projectedReadyDay: number | null;
  /** True as soon as ANY criterion has enough history to project — see CriterionForecast.hasEnoughData
   *  for the per-criterion state. Only false when every criterion is still too data-starved to project. */
  enoughData: boolean;
};

/**
 * Cap projections at Day 24 (10-day plan + two 7-day extensions' worth) — beyond that a straight
 * line is fiction, regardless of how many extensions the app allows.
 */
const MAX_PROJECTION_DAY = 24;
const GRADUATION_DAY_FLOOR = 10;

function latestPoint(points: ForecastPoint[]): ForecastPoint {
  return points.reduce((latest, p) => (p.day > latest.day ? p : latest), points[0]);
}

/** Ordinary least squares. Null with fewer than 3 points or zero x-variance (can't fit a line). */
export function linearFit(points: ForecastPoint[]): { slope: number; intercept: number } | null {
  if (points.length < 3) return null;
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.day, 0) / n;
  const meanY = points.reduce((s, p) => s + p.value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    numerator += (p.day - meanX) * (p.value - meanY);
    denominator += (p.day - meanX) * (p.day - meanX);
  }
  if (denominator === 0) return null;

  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

/**
 * Day the fitted line crosses `target` in the direction that satisfies the criterion, rounded up
 * to the next whole day after the last observed day. Null when there's no fit, the trend isn't
 * moving toward the target, the target is already met, or the crossing is beyond Day 24 (too far
 * out for a straight-line guess to mean anything).
 */
export function projectDay(points: ForecastPoint[], target: number, direction: ForecastDirection): number | null {
  if (points.length === 0) return null;
  const latest = latestPoint(points);
  const alreadyMet = direction === "atMost" ? latest.value <= target : latest.value >= target;
  if (alreadyMet) return null;

  const fit = linearFit(points);
  if (!fit) return null;

  const improving = direction === "atMost" ? fit.slope < 0 : fit.slope > 0;
  if (!improving) return null;

  const rawDay = (target - fit.intercept) / fit.slope;
  let day = Math.ceil(rawDay);
  if (day <= latest.day) day = latest.day + 1;
  if (day > MAX_PROJECTION_DAY) return null;
  return day;
}

function buildCriterion(
  label: string,
  target: number,
  direction: ForecastDirection,
  history: ForecastPoint[],
  graduation: GraduationResult
): CriterionForecast {
  const met = graduation.metCriteria.includes(label);
  const current = history.length ? latestPoint(history).value : null;
  const hasEnoughData = history.length >= 3;
  const projectedDay = met ? null : projectDay(history, target, direction);
  return { label, met, current, target, direction, projectedDay, hasEnoughData };
}

export function forecastGraduation(input: ForecastInput): ForecastResult {
  const criteria: CriterionForecast[] = [
    buildCriterion("Current pain ≤ 2", 2, "atMost", input.painHistory, input.graduation),
    buildCriterion("Worst spike ≤ 4", 4, "atMost", input.spikeHistory, input.graduation),
    buildCriterion(
      "Sitting tolerance ≥ 90 min (with breaks)",
      90,
      "atLeast",
      input.sittingHistory,
      input.graduation
    ),
    buildCriterion("Walking tolerance ≥ 30 min", 30, "atLeast", input.walkingHistory, input.graduation),
  ];

  const unmet = criteria.filter((c) => !c.met);
  const projectedReadyDay =
    unmet.length === 0
      ? GRADUATION_DAY_FLOOR
      : unmet.some((c) => c.projectedDay === null)
        ? null
        : Math.max(GRADUATION_DAY_FLOOR, ...(unmet.map((c) => c.projectedDay as number)));

  return {
    criteria,
    metCount: input.graduation.metCriteria.length,
    totalCount: input.graduation.metCriteria.length + input.graduation.missingCriteria.length,
    projectedReadyDay,
    enoughData: criteria.some((c) => c.hasEnoughData),
  };
}
