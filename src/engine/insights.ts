export type InsightPair = { x: number; y: number };

export type Insight = {
  key: string;
  label: string;
  n: number;
  r: number | null;
  strength: "insufficient" | "none" | "moderate" | "strong";
  sentence: string;
};

export type InsightsInput = {
  workVsSpike: InsightPair[];
  walkingVsNextMorning: InsightPair[];
  sleepVsPain: InsightPair[];
};

const MIN_PAIRS = 5;
const MODERATE_R = 0.5;
const STRONG_R = 0.75;

/** Standard Pearson correlation coefficient. Null if too few pairs or either side has zero variance. */
export function pearson(pairs: InsightPair[]): number | null {
  const n = pairs.length;
  if (n < 2) return null;

  const meanX = pairs.reduce((s, p) => s + p.x, 0) / n;
  const meanY = pairs.reduce((s, p) => s + p.y, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const p of pairs) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX === 0 || varY === 0) return null;

  return cov / Math.sqrt(varX * varY);
}

function round2(n: number): string {
  return n.toFixed(2);
}

type InsightSpec = {
  key: string;
  label: string;
  none: (n: number) => string;
  positive: (r2: string, n: number) => string;
  negative: (r2: string, n: number) => string;
};

const SPECS: InsightSpec[] = [
  {
    key: "workVsSpike",
    label: "Desk blocks vs evening spike",
    none: (n) => `No clear link between desk blocks and evening spikes so far (${n} days).`,
    positive: (r2, n) =>
      `Evening spikes ran higher on heavier desk days (r ${r2} across ${n} days) — association, not cause.`,
    negative: (r2, n) =>
      `Spikes ran LOWER on heavier desk days (r ${r2}, ${n} days) — unexpected; maybe breaks are working.`,
  },
  {
    key: "walkingVsNextMorning",
    label: "Walking vs next morning",
    none: (n) => `No clear link between walking and next-morning pain so far (${n} pairs).`,
    negative: (r2, n) =>
      `Mornings after bigger walking days started better (r ${r2}, ${n} pairs) — association, not cause.`,
    positive: (r2, n) =>
      `Mornings after bigger walking days started worse (r ${r2}, ${n} pairs) — worth pacing the walks.`,
  },
  {
    key: "sleepVsPain",
    label: "Sleep vs pain",
    none: (n) => `No clear link between sleep and pain so far (${n} days).`,
    negative: (r2, n) => `Better-slept days ran less painful (r ${r2}, ${n} days).`,
    positive: (r2, n) =>
      `Oddly, better sleep tracked with more pain (r ${r2}, ${n} days) — probably noise at this sample size.`,
  },
];

function computeOne(spec: InsightSpec, pairs: InsightPair[]): Insight {
  const n = pairs.length;
  if (n < MIN_PAIRS) {
    return {
      key: spec.key,
      label: spec.label,
      n,
      r: null,
      strength: "insufficient",
      sentence: `Still collecting — ${n} of ${MIN_PAIRS} days with both values logged.`,
    };
  }

  const r = pearson(pairs);
  if (r === null || Math.abs(r) < MODERATE_R) {
    return {
      key: spec.key,
      label: spec.label,
      n,
      r,
      strength: "none",
      sentence: spec.none(n),
    };
  }

  const strength = Math.abs(r) >= STRONG_R ? "strong" : "moderate";
  const r2 = round2(r);
  const sentence = r > 0 ? spec.positive(r2, n) : spec.negative(r2, n);
  return { key: spec.key, label: spec.label, n, r, strength, sentence };
}

export function computeInsights(input: InsightsInput): Insight[] {
  return [
    computeOne(SPECS[0], input.workVsSpike),
    computeOne(SPECS[1], input.walkingVsNextMorning),
    computeOne(SPECS[2], input.sleepVsPain),
  ];
}
