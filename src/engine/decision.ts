import type { Decision, RedFlags } from "../types";

export type DecisionInput = {
  dayNumber: number;
  redFlags: RedFlags;
  morningPain: number | null;
  currentPain: number | null;
  worstSpike: number | null;
  abdomenPressure: number | null;
  completionPct: number; // 0-100
  postExercisePainIncrease: number | null;
  painStillElevatedAfterOneHour: boolean;
  nextMorningWorse: boolean;
  symptomsSpread: boolean;
  /** Sitting tolerance minutes, oldest → newest, ending with today (nulls where unlogged). */
  sittingToleranceHistory: (number | null)[];
  standingToleranceHistory: (number | null)[];
};

export type DecisionResult = {
  decision: Decision;
  reasons: string[];
  /** Node ids for the flowchart: checkin, redflag-gate, get-checked, backoff-gate,
   * back-off, hold-gate, hold, advance-gate, advance, do-minimum */
  flowPath: string[];
};

export const RED_FLAG_LABELS: Record<keyof RedFlags, string> = {
  legWeakness: "New leg weakness",
  saddleNumbness: "Saddle or groin numbness",
  troubleWalking: "New trouble walking",
  bladderBowelChange: "Bladder or bowel control change",
  troubleStartingUrine: "Trouble starting urine",
  feverChills: "Fever or chills",
  vomiting: "Vomiting",
  bloodUrineStool: "Blood in urine or stool",
  worseningAbdominalPain: "Worsening deep abdominal pain",
};

export function activeRedFlags(flags: RedFlags): string[] {
  return (Object.keys(RED_FLAG_LABELS) as (keyof RedFlags)[])
    .filter((k) => flags[k])
    .map((k) => RED_FLAG_LABELS[k]);
}

/** True when the last 3 logged values show no improvement over 2 days. */
export function toleranceNotImproving(history: (number | null)[]): boolean {
  const vals = history.filter((v): v is number => v !== null && v !== undefined);
  if (vals.length < 3) return false;
  const [twoAgo, yesterday, today] = vals.slice(-3);
  return today <= twoAgo && yesterday <= twoAgo;
}

export function decide(input: DecisionInput): DecisionResult {
  const reasons: string[] = [];
  const flowPath = ["checkin", "redflag-gate"];

  // 1. GET_CHECKED — red flags override everything.
  const flags = activeRedFlags(input.redFlags);
  if (flags.length > 0 || (input.abdomenPressure !== null && input.abdomenPressure >= 7)) {
    reasons.push(...flags);
    if (input.abdomenPressure !== null && input.abdomenPressure >= 7) {
      reasons.push(`Abdominal pressure ${input.abdomenPressure}/10 (≥ 7)`);
    }
    flowPath.push("get-checked");
    return { decision: "GET_CHECKED", reasons, flowPath };
  }
  flowPath.push("backoff-gate");

  // No check-in yet → conservative hold until there is data.
  if (input.currentPain === null && input.morningPain === null) {
    flowPath.push("hold-gate", "hold");
    return {
      decision: "HOLD",
      reasons: ["No check-in data yet — holding at the gentle plan until you check in."],
      flowPath,
    };
  }

  // 2. BACK_OFF
  const backOff: string[] = [];
  if (input.currentPain !== null && input.currentPain >= 6) backOff.push(`Pain now ${input.currentPain}/10 (≥ 6)`);
  if (input.worstSpike !== null && input.worstSpike >= 8) backOff.push(`Worst spike ${input.worstSpike}/10 (≥ 8)`);
  if (input.symptomsSpread) backOff.push("Symptoms spreading outward/down");
  if (
    input.postExercisePainIncrease !== null &&
    input.postExercisePainIncrease >= 2 &&
    input.painStillElevatedAfterOneHour
  ) {
    backOff.push(`Exercise raised pain by ${input.postExercisePainIncrease} and it stayed up past 1 hour`);
  }
  if (input.nextMorningWorse) backOff.push("Worse the next morning");
  if (backOff.length > 0) {
    flowPath.push("back-off");
    return { decision: "BACK_OFF", reasons: backOff, flowPath };
  }
  flowPath.push("hold-gate");

  // 3. HOLD
  //
  // Band table for worstSpike / currentPain (both are 0-10, but inputs are not
  // guaranteed to be integers at this layer — see clampScore.ts for the UI-side
  // guard). Each row's upper bound is the lower bound of the row above it; the
  // BACK_OFF checks above already returned early, so reaching here guarantees
  // worstSpike < 8 and currentPain < 6.
  //   worstSpike:   [8, 10] -> BACK_OFF (handled above, before this point)
  //                 [7, 8)  -> HOLD (this block)
  //                 [0, 7)  -> no reason here (advance-gate's spikeOk covers <= 6)
  //   currentPain:  [6, 10] -> BACK_OFF (handled above, before this point)
  //                 [5, 6)  -> HOLD (this block)
  //                 [0, 5)  -> no reason here (advance-gate's painOk covers <= 4)
  //
  // These were previously exact-equality checks (`=== 7`, `=== 5`), which only
  // matched integers hitting that exact value — a fractional 7.3 or 5.6 would
  // fall through both this block AND the advance-gate's <= 6 / <= 4 checks,
  // silently landing in DO_MINIMUM with no named reason. Using ">=" (with the
  // upper bound already guaranteed by the earlier return) closes that gap
  // without changing which branch any integer 0-10 input hits.
  const hold: string[] = [];
  if (input.worstSpike !== null && input.worstSpike >= 7) hold.push("Worst spike is 7/10 or higher");
  if (input.currentPain !== null && input.currentPain >= 5) hold.push("Pain now is 5/10 or higher");
  if (input.abdomenPressure !== null && input.abdomenPressure >= 4 && input.abdomenPressure <= 6) {
    hold.push(`Abdominal pressure ${input.abdomenPressure}/10 (4–6 zone — keep watching this)`);
  }
  if (input.completionPct < 50) hold.push(`Completion ${Math.round(input.completionPct)}% (< 50%)`);
  if (toleranceNotImproving(input.sittingToleranceHistory)) hold.push("Sitting tolerance flat for 2 days");
  if (toleranceNotImproving(input.standingToleranceHistory)) hold.push("Standing tolerance flat for 2 days");
  if (hold.length > 0) {
    flowPath.push("hold");
    return { decision: "HOLD", reasons: hold, flowPath };
  }
  flowPath.push("advance-gate");

  // 4. ADVANCE vs DO_MINIMUM
  const painOk = input.currentPain !== null && input.currentPain <= 4;
  const spikeOk = input.worstSpike === null || input.worstSpike <= 6;
  const abdomenOk = input.abdomenPressure === null || input.abdomenPressure <= 3;
  const postExOk =
    input.postExercisePainIncrease === null ||
    input.postExercisePainIncrease < 2 ||
    !input.painStillElevatedAfterOneHour;
  const completionOk = input.completionPct >= 66;

  if (painOk && spikeOk && abdomenOk && postExOk && !input.nextMorningWorse && completionOk) {
    flowPath.push("advance");
    return {
      decision: "ADVANCE",
      reasons: [
        `Pain ≤ 4, spike ≤ 6, abdominal pressure ≤ 3, completion ${Math.round(input.completionPct)}%`,
        "No spreading, no next-morning worsening",
      ],
      flowPath,
    };
  }

  flowPath.push("do-minimum");
  const dm: string[] = [];
  if (!completionOk) dm.push(`Symptoms are acceptable but completion is ${Math.round(input.completionPct)}% (< 66%)`);
  if (!painOk && input.currentPain !== null) dm.push(`Pain now ${input.currentPain}/10 — keep it gentle`);
  if (dm.length === 0) dm.push("Not all green criteria met — do the minimum plan and re-check tomorrow");
  return { decision: "DO_MINIMUM", reasons: dm, flowPath };
}

// ------------------------------------------------------------------ graduation

export type GraduationInput = {
  dayNumber: number;
  greenStreak: number; // consecutive ADVANCE days ending today
  currentPain: number | null;
  worstSpike: number | null;
  abdomenPressure: number | null;
  sittingToleranceMinutes: number | null;
  walkingToleranceMinutes: number | null;
  redFlagsActive: boolean;
  symptomsSpread: boolean;
  nextMorningWorse: boolean;
};

export type GraduationResult = {
  eligible: boolean;
  metCriteria: string[];
  missingCriteria: string[];
};

export function checkGraduation(g: GraduationInput): GraduationResult {
  const met: string[] = [];
  const missing: string[] = [];
  const push = (ok: boolean, label: string) => (ok ? met : missing).push(label);

  push(g.greenStreak >= 3, "3+ consecutive green days");
  push(g.currentPain !== null && g.currentPain <= 2, "Current pain ≤ 2");
  push(g.worstSpike !== null && g.worstSpike <= 4, "Worst spike ≤ 4");
  push(g.abdomenPressure !== null && g.abdomenPressure <= 2, "Abdominal pressure ≤ 2");
  push(g.sittingToleranceMinutes !== null && g.sittingToleranceMinutes >= 90, "Sitting tolerance ≥ 90 min (with breaks)");
  push(g.walkingToleranceMinutes !== null && g.walkingToleranceMinutes >= 30, "Walking tolerance ≥ 30 min");
  push(!g.redFlagsActive, "No red flags");
  push(!g.symptomsSpread, "No symptom spread");
  push(!g.nextMorningWorse, "Maintenance-level circuit tolerated without next-day worsening");

  return { eligible: missing.length === 0, metCriteria: met, missingCriteria: missing };
}

// ------------------------------------------------------------------- day 10+

export type PlanStatus =
  | { kind: "continue" }
  | { kind: "graduate"; result: GraduationResult }
  | { kind: "extend"; extensionKind: ExtensionSuggestion; reasons: string[] }
  | { kind: "formal-help"; reasons: string[] };

export type ExtensionSuggestion =
  | "repeat-stabilize"
  | "slow-progression"
  | "walking-focus"
  | "desk-resilience"
  | "stability-focus";

export type PlanStatusInput = {
  dayNumber: number;
  graduation: GraduationInput;
  lastDecision: Decision | null;
  /** first logged pain vs recent pain, both morning, for the "50% improved" test */
  firstPain: number | null;
  recentPain: number | null;
  recentSpikes: (number | null)[];
  recentAbdomen: (number | null)[];
  symptomsSpreadRecently: boolean;
  backOffCount: number;
  walkingToleranceMinutes: number | null;
  sittingToleranceMinutes: number | null;
  strengthCompletionPct: number; // completion across strength tasks, recent days
};

export function formalHelpReasons(s: PlanStatusInput): string[] {
  const reasons: string[] = [];
  if (s.firstPain !== null && s.recentPain !== null && s.firstPain > 0) {
    const improvement = (s.firstPain - s.recentPain) / s.firstPain;
    if (improvement < 0.5) {
      reasons.push(`Less than 50% improved by Day ${s.dayNumber} (pain ${s.firstPain} → ${s.recentPain})`);
    }
  }
  const spikes = s.recentSpikes.filter((v): v is number => v !== null);
  if (spikes.length >= 2 && spikes.slice(-2).every((v) => v >= 7)) {
    reasons.push("Spikes still reaching 7+ recently");
  }
  const abdo = s.recentAbdomen.filter((v): v is number => v !== null);
  if (abdo.length >= 2 && abdo.slice(-2).every((v) => v >= 4)) {
    reasons.push("Abdominal pressure persisting at 4+ — worth mentioning to a clinician");
  }
  if (s.symptomsSpreadRecently) reasons.push("Symptoms have been spreading");
  if (s.backOffCount >= 3) reasons.push(`${s.backOffCount} Back-Off days — the plan is not holding`);
  return reasons;
}

export function evaluatePlanStatus(s: PlanStatusInput): PlanStatus {
  if (s.dayNumber < 10) return { kind: "continue" };

  const grad = checkGraduation(s.graduation);
  if (grad.eligible) return { kind: "graduate", result: grad };

  const help = formalHelpReasons(s);
  // Improving at all? (pain down vs start, no persistent trouble)
  const improving =
    s.firstPain !== null && s.recentPain !== null ? s.recentPain < s.firstPain : false;

  if (!improving || help.length >= 2) {
    return {
      kind: "formal-help",
      reasons: help.length > 0 ? help : ["Not clearly improving by Day 10"],
    };
  }

  // Choose extension flavor from what is weakest.
  let extensionKind: ExtensionSuggestion;
  const reasons: string[] = [];
  if (s.lastDecision === "HOLD" || s.lastDecision === "BACK_OFF") {
    extensionKind = "repeat-stabilize";
    reasons.push("Recent Hold/Back-Off — repeat the Stabilize phase at tolerated doses.");
  } else if (s.walkingToleranceMinutes !== null && s.walkingToleranceMinutes < 20) {
    extensionKind = "walking-focus";
    reasons.push("Walking tolerance is the weak link — walking-focused extension.");
  } else if (s.sittingToleranceMinutes !== null && s.sittingToleranceMinutes < 60) {
    extensionKind = "desk-resilience";
    reasons.push("Sitting is still the main trigger — desk-resilience extension.");
  } else if (s.strengthCompletionPct < 66) {
    extensionKind = "stability-focus";
    reasons.push("Strength tasks are lagging — stability-focused extension.");
  } else {
    extensionKind = "slow-progression";
    reasons.push("Green but not at graduation criteria — repeat Control/Return with slower progression.");
  }
  return { kind: "extend", extensionKind, reasons };
}
