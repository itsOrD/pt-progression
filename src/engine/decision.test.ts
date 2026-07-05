import { describe, expect, it } from "vitest";
import {
  checkGraduation,
  decide,
  evaluatePlanStatus,
  toleranceNotImproving,
  type DecisionInput,
  type GraduationInput,
  type PlanStatusInput,
} from "./decision";
import { EMPTY_RED_FLAGS } from "../types";

function input(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    dayNumber: 3,
    redFlags: { ...EMPTY_RED_FLAGS },
    morningPain: 3,
    currentPain: 3,
    worstSpike: 4,
    abdomenPressure: 2,
    completionPct: 80,
    postExercisePainIncrease: 0,
    painStillElevatedAfterOneHour: false,
    nextMorningWorse: false,
    symptomsSpread: false,
    sittingToleranceHistory: [20, 30, 40],
    standingToleranceHistory: [10, 15, 20],
    ...overrides,
  };
}

describe("decide — GET_CHECKED", () => {
  it("fires on any red flag", () => {
    const r = decide(input({ redFlags: { ...EMPTY_RED_FLAGS, saddleNumbness: true } }));
    expect(r.decision).toBe("GET_CHECKED");
    expect(r.reasons.join(" ")).toMatch(/saddle/i);
    expect(r.flowPath).toContain("get-checked");
  });

  it("fires on abdomen pressure >= 7", () => {
    expect(decide(input({ abdomenPressure: 7 })).decision).toBe("GET_CHECKED");
    expect(decide(input({ abdomenPressure: 10 })).decision).toBe("GET_CHECKED");
  });

  it("overrides otherwise-green data", () => {
    const r = decide(input({ currentPain: 0, redFlags: { ...EMPTY_RED_FLAGS, feverChills: true } }));
    expect(r.decision).toBe("GET_CHECKED");
  });
});

describe("decide — BACK_OFF", () => {
  it("fires on current pain >= 6", () => {
    expect(decide(input({ currentPain: 6 })).decision).toBe("BACK_OFF");
  });
  it("fires on spike >= 8", () => {
    expect(decide(input({ worstSpike: 8 })).decision).toBe("BACK_OFF");
  });
  it("fires on symptom spread", () => {
    expect(decide(input({ symptomsSpread: true })).decision).toBe("BACK_OFF");
  });
  it("fires on post-exercise increase >= 2 that stays elevated an hour", () => {
    expect(
      decide(input({ postExercisePainIncrease: 2, painStillElevatedAfterOneHour: true })).decision
    ).toBe("BACK_OFF");
  });
  it("does NOT fire when the increase resolves within the hour", () => {
    const r = decide(input({ postExercisePainIncrease: 3, painStillElevatedAfterOneHour: false }));
    expect(r.decision).not.toBe("BACK_OFF");
  });
  it("fires on next-morning worsening", () => {
    expect(decide(input({ nextMorningWorse: true })).decision).toBe("BACK_OFF");
  });
});

describe("decide — HOLD", () => {
  it("fires on spike exactly 7", () => {
    expect(decide(input({ worstSpike: 7 })).decision).toBe("HOLD");
  });
  it("fires on current pain exactly 5", () => {
    expect(decide(input({ currentPain: 5 })).decision).toBe("HOLD");
  });
  it("fires on abdomen pressure 4-6", () => {
    expect(decide(input({ abdomenPressure: 4 })).decision).toBe("HOLD");
    expect(decide(input({ abdomenPressure: 6 })).decision).toBe("HOLD");
  });
  it("fires on completion < 50%", () => {
    expect(decide(input({ completionPct: 49 })).decision).toBe("HOLD");
  });
  it("fires when sitting tolerance is flat for 2 days", () => {
    expect(decide(input({ sittingToleranceHistory: [40, 35, 40] })).decision).toBe("HOLD");
  });
  it("holds conservatively when there is no check-in data", () => {
    const r = decide(input({ currentPain: null, morningPain: null, worstSpike: null }));
    expect(r.decision).toBe("HOLD");
  });
});

describe("decide — ADVANCE / DO_MINIMUM", () => {
  it("advances on a green day", () => {
    const r = decide(input());
    expect(r.decision).toBe("ADVANCE");
    expect(r.flowPath).toEqual(["checkin", "redflag-gate", "backoff-gate", "hold-gate", "advance-gate", "advance"]);
  });
  it("does minimum when pain is fine but completion is 50-65%", () => {
    expect(decide(input({ completionPct: 60 })).decision).toBe("DO_MINIMUM");
  });
  it("advances at exactly 66% completion", () => {
    expect(decide(input({ completionPct: 66 })).decision).toBe("ADVANCE");
  });
  it("advance allowed before evening review (spike unknown)", () => {
    expect(decide(input({ worstSpike: null, postExercisePainIncrease: null })).decision).toBe("ADVANCE");
  });
});

describe("toleranceNotImproving", () => {
  it("needs at least 3 logged values", () => {
    expect(toleranceNotImproving([null, 30, 30])).toBe(false);
  });
  it("true when today and yesterday are not above two days ago", () => {
    expect(toleranceNotImproving([30, 30, 30])).toBe(true);
    expect(toleranceNotImproving([30, 25, 28])).toBe(true);
  });
  it("false when improving", () => {
    expect(toleranceNotImproving([20, 30, 40])).toBe(false);
  });
});

describe("checkGraduation", () => {
  const good: GraduationInput = {
    dayNumber: 10,
    greenStreak: 3,
    currentPain: 1,
    worstSpike: 3,
    abdomenPressure: 1,
    sittingToleranceMinutes: 95,
    walkingToleranceMinutes: 35,
    redFlagsActive: false,
    symptomsSpread: false,
    nextMorningWorse: false,
  };

  it("eligible when all criteria met", () => {
    const r = checkGraduation(good);
    expect(r.eligible).toBe(true);
    expect(r.missingCriteria).toHaveLength(0);
    expect(r.metCriteria.length).toBe(9);
  });

  it("blocks on short green streak", () => {
    const r = checkGraduation({ ...good, greenStreak: 2 });
    expect(r.eligible).toBe(false);
    expect(r.missingCriteria.join(" ")).toMatch(/green days/);
  });

  it("blocks on sitting tolerance below 90", () => {
    expect(checkGraduation({ ...good, sittingToleranceMinutes: 60 }).eligible).toBe(false);
  });
});

describe("evaluatePlanStatus", () => {
  const base: PlanStatusInput = {
    dayNumber: 10,
    graduation: {
      dayNumber: 10,
      greenStreak: 1,
      currentPain: 3,
      worstSpike: 5,
      abdomenPressure: 2,
      sittingToleranceMinutes: 70,
      walkingToleranceMinutes: 25,
      redFlagsActive: false,
      symptomsSpread: false,
      nextMorningWorse: false,
    },
    lastDecision: "ADVANCE",
    firstPain: 6,
    recentPain: 3,
    recentSpikes: [5, 5, 4],
    recentAbdomen: [2, 2, 1],
    symptomsSpreadRecently: false,
    backOffCount: 1,
    walkingToleranceMinutes: 25,
    sittingToleranceMinutes: 70,
    strengthCompletionPct: 80,
  };

  it("continues before day 10", () => {
    expect(evaluatePlanStatus({ ...base, dayNumber: 7 }).kind).toBe("continue");
  });

  it("graduates when criteria are met", () => {
    const s = evaluatePlanStatus({
      ...base,
      graduation: {
        ...base.graduation,
        greenStreak: 3,
        currentPain: 1,
        worstSpike: 3,
        abdomenPressure: 1,
        sittingToleranceMinutes: 95,
        walkingToleranceMinutes: 35,
      },
    });
    expect(s.kind).toBe("graduate");
  });

  it("recommends extension when improving but not graduated", () => {
    const s = evaluatePlanStatus(base);
    expect(s.kind).toBe("extend");
  });

  it("picks repeat-stabilize after a recent hold/back-off", () => {
    const s = evaluatePlanStatus({ ...base, lastDecision: "BACK_OFF" });
    expect(s.kind).toBe("extend");
    if (s.kind === "extend") expect(s.extensionKind).toBe("repeat-stabilize");
  });

  it("picks walking-focus when walking tolerance is weak", () => {
    const s = evaluatePlanStatus({ ...base, walkingToleranceMinutes: 10 });
    if (s.kind === "extend") expect(s.extensionKind).toBe("walking-focus");
    else expect.fail("expected extend");
  });

  it("recommends formal help when not improving", () => {
    const s = evaluatePlanStatus({ ...base, firstPain: 4, recentPain: 5 });
    expect(s.kind).toBe("formal-help");
  });

  it("recommends formal help on repeated back-offs plus persistent spikes", () => {
    const s = evaluatePlanStatus({
      ...base,
      backOffCount: 4,
      recentSpikes: [8, 7, 7],
    });
    expect(s.kind).toBe("formal-help");
  });
});
