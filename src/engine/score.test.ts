import { describe, expect, it } from "vitest";
import { recoveryScore, type ScoreInput } from "./score";

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    firstPain: 6,
    recentPain: 3,
    firstSpike: 8,
    recentSpike: 4,
    firstAbdomen: 4,
    recentAbdomen: 2,
    walkingToleranceMinutes: 20,
    sittingToleranceMinutes: 60,
    avgCompletionPct: 75,
    symptomsSpreadRecently: false,
    nextMorningWorseRecently: false,
    formalHelpRecommended: false,
    ...overrides,
  };
}

describe("recoveryScore", () => {
  it("sums components to the score and stays within 0-100", () => {
    const r = recoveryScore(input());
    expect(r.score).toBe(r.components.reduce((s, c) => s + c.points, 0));
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("labels a fully recovered picture as ready for maintenance", () => {
    const r = recoveryScore(
      input({
        recentPain: 0,
        recentSpike: 0,
        recentAbdomen: 0,
        walkingToleranceMinutes: 40,
        sittingToleranceMinutes: 120,
        avgCompletionPct: 95,
      })
    );
    expect(r.label).toBe("Ready for maintenance");
  });

  it("labels a rough start as still irritable", () => {
    const r = recoveryScore(
      input({
        firstPain: 5,
        recentPain: 5,
        firstSpike: 8,
        recentSpike: 8,
        firstAbdomen: 4,
        recentAbdomen: 4,
        walkingToleranceMinutes: 5,
        sittingToleranceMinutes: 15,
        avgCompletionPct: 20,
        symptomsSpreadRecently: true,
        nextMorningWorseRecently: true,
      })
    );
    expect(r.label).toBe("Still irritable");
  });

  it("clinician-input flag overrides the label", () => {
    const r = recoveryScore(input({ formalHelpRecommended: true }));
    expect(r.label).toBe("Needs clinician input");
    expect(r.explanation).toMatch(/clinician/i);
  });

  it("always explains itself", () => {
    expect(recoveryScore(input()).explanation.length).toBeGreaterThan(20);
    expect(recoveryScore(input()).components.length).toBe(8);
  });

  it("handles missing data without NaN", () => {
    const r = recoveryScore(
      input({
        firstPain: null,
        recentPain: null,
        firstSpike: null,
        recentSpike: null,
        firstAbdomen: null,
        recentAbdomen: null,
        walkingToleranceMinutes: null,
        sittingToleranceMinutes: null,
        avgCompletionPct: 0,
      })
    );
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBe(10); // only the two "no spread / no worse mornings" components
  });
});
