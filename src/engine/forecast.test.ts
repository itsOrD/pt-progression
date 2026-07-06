import { describe, expect, it } from "vitest";
import { forecastGraduation, linearFit, projectDay, type ForecastInput, type ForecastPoint } from "./forecast";
import type { GraduationResult } from "./decision";

const ALL_LABELS = [
  "3+ consecutive green days",
  "Current pain ≤ 2",
  "Worst spike ≤ 4",
  "Abdominal pressure ≤ 2",
  "Sitting tolerance ≥ 90 min (with breaks)",
  "Walking tolerance ≥ 30 min",
  "No red flags",
  "No symptom spread",
  "Maintenance-level circuit tolerated without next-day worsening",
];

function graduation(missing: string[]): GraduationResult {
  const metCriteria = ALL_LABELS.filter((l) => !missing.includes(l));
  return { eligible: missing.length === 0, metCriteria, missingCriteria: [...missing] };
}

function pts(values: number[], startDay = 1): ForecastPoint[] {
  return values.map((value, i) => ({ day: startDay + i, value }));
}

const DEFAULT_MISSING = [
  "3+ consecutive green days",
  "Current pain ≤ 2",
  "Worst spike ≤ 4",
  "Abdominal pressure ≤ 2",
  "Sitting tolerance ≥ 90 min (with breaks)",
  "Walking tolerance ≥ 30 min",
];

function input(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    dayNumber: 4,
    graduation: graduation(DEFAULT_MISSING),
    painHistory: pts([6, 5, 4]),
    spikeHistory: pts([7, 6, 5]),
    sittingHistory: pts([30, 45, 60]),
    walkingHistory: pts([10, 15, 20]),
    ...overrides,
  };
}

describe("linearFit", () => {
  it("fits an OLS line through a simple descending series", () => {
    const fit = linearFit(pts([6, 5, 4]));
    expect(fit).not.toBeNull();
    expect(fit!.slope).toBeCloseTo(-1, 10);
    expect(fit!.intercept).toBeCloseTo(7, 10);
  });

  it("returns null with fewer than 3 points", () => {
    expect(linearFit(pts([6, 5]))).toBeNull();
  });

  it("returns null with zero x-variance (all points on the same day)", () => {
    expect(
      linearFit([
        { day: 3, value: 1 },
        { day: 3, value: 2 },
        { day: 3, value: 3 },
      ])
    ).toBeNull();
  });
});

describe("projectDay", () => {
  it("projects the day a clean improving series crosses the target", () => {
    // pain 6,5,4 over days 1-3 fits value = -day + 7; crosses 2 at day 5.
    expect(projectDay(pts([6, 5, 4]), 2, "atMost")).toBe(5);
  });

  it("returns null for a flat series", () => {
    expect(projectDay(pts([5, 5, 5]), 2, "atMost")).toBeNull();
  });

  it("returns null for a worsening series (wrong direction for the target)", () => {
    expect(projectDay(pts([3, 4, 5]), 2, "atMost")).toBeNull();
  });

  it("returns null when the target is already met", () => {
    expect(projectDay(pts([3, 2, 1]), 2, "atMost")).toBeNull();
  });

  it("returns null when the crossing lands beyond day 24", () => {
    expect(projectDay(pts([9, 8.9, 8.8]), 2, "atMost")).toBeNull();
  });

  it("handles an 'at least' target the same way, mirrored", () => {
    expect(projectDay(pts([30, 45, 60]), 90, "atLeast")).toBe(5);
    expect(projectDay(pts([60, 45, 30]), 90, "atLeast")).toBeNull();
  });
});

describe("forecastGraduation", () => {
  it("projects a crossing day for an unmet, cleanly improving numeric criterion", () => {
    const result = forecastGraduation(input());
    const pain = result.criteria.find((c) => c.label === "Current pain ≤ 2")!;
    expect(pain.met).toBe(false);
    expect(pain.current).toBe(4);
    expect(pain.projectedDay).toBe(5);
  });

  it("reports no clear trend (null projectedDay) for a flat/worsening series", () => {
    const result = forecastGraduation(input({ painHistory: pts([4, 4, 4]) }));
    const pain = result.criteria.find((c) => c.label === "Current pain ≤ 2")!;
    expect(pain.projectedDay).toBeNull();
  });

  it("marks an already-met criterion as met with no projection needed", () => {
    const missing = DEFAULT_MISSING.filter((l) => l !== "Current pain ≤ 2");
    const result = forecastGraduation(
      input({ graduation: graduation(missing), painHistory: pts([4, 3, 2]) })
    );
    const pain = result.criteria.find((c) => c.label === "Current pain ≤ 2")!;
    expect(pain.met).toBe(true);
    expect(pain.projectedDay).toBeNull();
  });

  it("flags a criterion with fewer than 3 of its own points as not-enough-data, and skips its projection", () => {
    // Only pain is short on history here; sitting/walking/spike still have 3 points each, so the
    // card as a whole isn't data-starved — see the next two tests for that distinction.
    const result = forecastGraduation(input({ painHistory: pts([5, 4]) }));
    const pain = result.criteria.find((c) => c.label === "Current pain ≤ 2")!;
    expect(pain.hasEnoughData).toBe(false);
    expect(pain.projectedDay).toBeNull();
  });

  it("still projects criteria with enough history even when another criterion is data-starved", () => {
    // A user who skips pain check-ins but keeps logging sitting/walking shouldn't lose those
    // projections — each criterion owns its own sufficiency, not a single card-wide gate.
    const result = forecastGraduation(input({ painHistory: pts([5, 4]) }));
    const sitting = result.criteria.find((c) => c.label.startsWith("Sitting"))!;
    const walking = result.criteria.find((c) => c.label.startsWith("Walking"))!;
    expect(sitting.hasEnoughData).toBe(true);
    expect(sitting.projectedDay).not.toBeNull();
    expect(walking.hasEnoughData).toBe(true);
    expect(walking.projectedDay).not.toBeNull();
    // The card renders projections despite pain being short on data.
    expect(result.enoughData).toBe(true);
  });

  it("marks the card as too-early only when every criterion lacks its own history", () => {
    const result = forecastGraduation(
      input({
        painHistory: pts([5, 4]),
        spikeHistory: pts([6, 5]),
        sittingHistory: pts([30, 45]),
        walkingHistory: pts([10, 15]),
      })
    );
    expect(result.criteria.every((c) => !c.hasEnoughData)).toBe(true);
    expect(result.enoughData).toBe(false);
  });

  it("floors projectedReadyDay at day 10 even when every criterion crosses earlier", () => {
    // Default fixture: pain/spike/sitting/walking all cross their targets by day 4-5.
    const result = forecastGraduation(input());
    expect(result.projectedReadyDay).toBe(10);
  });

  it("returns null projectedReadyDay when any unmet numeric criterion has no clear trend", () => {
    const result = forecastGraduation(input({ spikeHistory: pts([5, 6, 7]) })); // worsening
    expect(result.projectedReadyDay).toBeNull();
  });

  it("counts met/total criteria straight from the graduation result", () => {
    const result = forecastGraduation(input());
    expect(result.metCount).toBe(3); // no red flags / no spread / no next-morning worsening
    expect(result.totalCount).toBe(9);
  });
});
