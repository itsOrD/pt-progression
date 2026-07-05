export type ScoreComponent = {
  label: string;
  points: number;
  max: number;
  detail: string;
};

export type RecoveryScore = {
  score: number; // 0-100
  label:
    | "Still irritable"
    | "Stabilizing"
    | "Building capacity"
    | "Ready for maintenance"
    | "Needs clinician input";
  components: ScoreComponent[];
  explanation: string;
};

export type ScoreInput = {
  firstPain: number | null;
  recentPain: number | null;
  firstSpike: number | null;
  recentSpike: number | null;
  firstAbdomen: number | null;
  recentAbdomen: number | null;
  walkingToleranceMinutes: number | null;
  sittingToleranceMinutes: number | null;
  avgCompletionPct: number;
  symptomsSpreadRecently: boolean;
  nextMorningWorseRecently: boolean;
  formalHelpRecommended: boolean;
};

function improvementPoints(first: number | null, recent: number | null, max: number): { pts: number; detail: string } {
  if (first === null || recent === null) return { pts: 0, detail: "Not enough data yet" };
  if (first <= 0) return { pts: recent <= 0 ? max : 0, detail: `Started at 0, now ${recent}` };
  const frac = Math.max(0, Math.min(1, (first - recent) / first));
  return { pts: Math.round(frac * max), detail: `${first} → ${recent}` };
}

function tolerancePoints(minutes: number | null, target: number, max: number): { pts: number; detail: string } {
  if (minutes === null) return { pts: 0, detail: "Not logged yet" };
  const frac = Math.max(0, Math.min(1, minutes / target));
  return { pts: Math.round(frac * max), detail: `${minutes} min (target ${target})` };
}

export function recoveryScore(input: ScoreInput): RecoveryScore {
  const components: ScoreComponent[] = [];

  const pain = improvementPoints(input.firstPain, input.recentPain, 20);
  components.push({ label: "Pain improvement", points: pain.pts, max: 20, detail: pain.detail });

  const spike = improvementPoints(input.firstSpike, input.recentSpike, 15);
  components.push({ label: "Spike improvement", points: spike.pts, max: 15, detail: spike.detail });

  const abdo = improvementPoints(input.firstAbdomen, input.recentAbdomen, 10);
  components.push({ label: "Abdominal pressure improvement", points: abdo.pts, max: 10, detail: abdo.detail });

  const walk = tolerancePoints(input.walkingToleranceMinutes, 30, 15);
  components.push({ label: "Walking tolerance", points: walk.pts, max: 15, detail: walk.detail });

  const sit = tolerancePoints(input.sittingToleranceMinutes, 90, 15);
  components.push({ label: "Sitting tolerance (with breaks)", points: sit.pts, max: 15, detail: sit.detail });

  const completion = Math.round(Math.max(0, Math.min(1, input.avgCompletionPct / 100)) * 15);
  components.push({
    label: "Task completion",
    points: completion,
    max: 15,
    detail: `${Math.round(input.avgCompletionPct)}% average`,
  });

  components.push({
    label: "No symptom spread",
    points: input.symptomsSpreadRecently ? 0 : 5,
    max: 5,
    detail: input.symptomsSpreadRecently ? "Symptoms spread recently" : "No spread recently",
  });
  components.push({
    label: "No next-morning worsening",
    points: input.nextMorningWorseRecently ? 0 : 5,
    max: 5,
    detail: input.nextMorningWorseRecently ? "Worse mornings recently" : "Mornings holding steady",
  });

  const score = components.reduce((s, c) => s + c.points, 0);

  let label: RecoveryScore["label"];
  if (input.formalHelpRecommended) label = "Needs clinician input";
  else if (score >= 85) label = "Ready for maintenance";
  else if (score >= 60) label = "Building capacity";
  else if (score >= 35) label = "Stabilizing";
  else label = "Still irritable";

  const top = [...components].sort((a, b) => b.points / b.max - a.points / a.max);
  const strongest = top[0];
  const weakest = top[top.length - 1];
  const explanation = input.formalHelpRecommended
    ? "Label overridden: the plan-status check recommends clinician input, so the score label defers to that."
    : `Score ${score}/100. Strongest area: ${strongest.label.toLowerCase()} (${strongest.points}/${strongest.max}). ` +
      `Weakest area: ${weakest.label.toLowerCase()} (${weakest.points}/${weakest.max}). ` +
      "This is a transparent tally of the components below — not a medical measurement.";

  return { score, label, components, explanation };
}
