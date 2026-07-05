import { describe, expect, it } from "vitest";
import { adjustPlan, completionPct, doseFor, swapCandidates } from "./adjust";
import { PHASES } from "../data/plan";
import { EXERCISES, getExercise } from "../data/exercises";

describe("adjustPlan", () => {
  const phase2 = PHASES[1];

  it("keeps everything at progressed doses on ADVANCE", () => {
    const plan = adjustPlan(phase2, "ADVANCE", {}, false);
    expect(plan.droppedTaskIds).toHaveLength(0);
    const brace = plan.tasks.find((t) => t.exerciseId === "abdominal-brace")!;
    expect(brace.dose).toBe(getExercise("abdominal-brace").progressDose);
  });

  it("drops non-core tasks on DO_MINIMUM", () => {
    const plan = adjustPlan(phase2, "DO_MINIMUM", {}, false);
    expect(plan.tasks.every((t) => t.core)).toBe(true);
    expect(plan.droppedTaskIds.length).toBeGreaterThan(0);
  });

  it("keeps only relief/desk/flare-safe items on BACK_OFF at regressed doses", () => {
    const plan = adjustPlan(phase2, "BACK_OFF", {}, false);
    for (const t of plan.tasks) {
      const ex = getExercise(t.exerciseId);
      expect(
        ex.element === "relief" || ex.element === "desk-reset" || ex.safeWhenFlared
      ).toBe(true);
      expect(t.dose).toBe(ex.regressDose);
    }
  });

  it("keeps only gentle relief on GET_CHECKED", () => {
    const plan = adjustPlan(phase2, "GET_CHECKED", {}, false);
    for (const t of plan.tasks) {
      expect(getExercise(t.exerciseId).element).toBe("relief");
    }
  });

  it("drops avoid-if-spreading exercises when symptoms spread", () => {
    const phase4 = PHASES[3];
    const plan = adjustPlan(phase4, "HOLD", {}, true);
    for (const t of plan.tasks) {
      expect(getExercise(t.exerciseId).avoidIfSpreading ?? false).toBe(false);
    }
  });

  it("applies swaps", () => {
    const plan = adjustPlan(phase2, "ADVANCE", { "p2-clam": "glute-squeeze" }, false);
    const swapped = plan.tasks.find((t) => t.taskId === "p2-clam")!;
    expect(swapped.exerciseId).toBe("glute-squeeze");
  });
});

describe("swapCandidates", () => {
  it("bridge offers bracing/glute-squeeze/sit-to-stand/clamshell as the brief requires", () => {
    const ids = swapCandidates("bridge", "ADVANCE").map((e) => e.id);
    for (const expected of ["abdominal-brace", "glute-squeeze", "sit-to-stand", "clamshell"]) {
      expect(ids).toContain(expected);
    }
  });

  it("bird dog offers easier variants", () => {
    const ids = swapCandidates("bird-dog-full", "ADVANCE").map((e) => e.id);
    expect(ids).toContain("bird-dog-arms");
    expect(ids).toContain("bird-dog-legs");
  });

  it("hip flexor opener offers walk/tilts/glute-squeeze/9090", () => {
    const ids = swapCandidates("hip-flexor-opener", "HOLD").map((e) => e.id);
    for (const expected of ["short-walk", "pelvic-tilts", "glute-squeeze", "ninety-ninety-rest"]) {
      expect(ids).toContain(expected);
    }
  });

  it("restricts to equal-or-lower irritability on HOLD/BACK_OFF", () => {
    const rank = { low: 0, medium: 1, higher: 2 };
    for (const decision of ["HOLD", "BACK_OFF"] as const) {
      for (const ex of swapCandidates("bridge", decision)) {
        expect(rank[ex.irritability]).toBeLessThanOrEqual(rank[getExercise("bridge").irritability]);
      }
    }
  });

  it("allows same or slightly higher difficulty when green", () => {
    const bridge = getExercise("bridge");
    for (const ex of swapCandidates("bridge", "ADVANCE")) {
      expect(ex.difficulty).toBeLessThanOrEqual(bridge.difficulty + 1);
    }
  });

  it("never returns the exercise itself", () => {
    for (const id of Object.keys(EXERCISES)) {
      const ids = swapCandidates(id, "ADVANCE").map((e) => e.id);
      expect(ids).not.toContain(id);
    }
  });
});

describe("exercise data integrity", () => {
  it("every substitution id exists", () => {
    for (const ex of Object.values(EXERCISES)) {
      for (const sub of ex.substitutions) {
        expect(EXERCISES[sub], `${ex.id} → ${sub}`).toBeDefined();
      }
    }
  });
  it("every exercise has a why, stop rules or explicit empty, and research links", () => {
    for (const ex of Object.values(EXERCISES)) {
      expect(ex.why.length).toBeGreaterThan(10);
      expect(ex.researchLinks.length).toBeGreaterThan(0);
      expect(ex.media.length).toBeGreaterThan(0);
    }
  });
  it("plan tasks reference real exercises", () => {
    for (const phase of PHASES) {
      for (const t of phase.tasks) {
        expect(EXERCISES[t.exerciseId], `${phase.name}:${t.taskId}`).toBeDefined();
      }
    }
  });
});

describe("completionPct and doses", () => {
  it("computes completion", () => {
    expect(completionPct(["a", "b", "c"], ["a", "b"])).toBeCloseTo(66.67, 1);
    expect(completionPct([], [])).toBe(0);
  });
  it("doseFor picks the right dose string", () => {
    const ex = getExercise("bridge");
    expect(doseFor(ex, "min")).toBe(ex.minDose);
    expect(doseFor(ex, "progress")).toBe(ex.progressDose);
  });
});
