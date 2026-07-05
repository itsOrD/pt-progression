import { describe, expect, it } from "vitest";
import { computeInsights, pearson, type Insight, type InsightPair, type InsightsInput } from "./insights";

function pairs(xs: number[], ys: number[]): InsightPair[] {
  return xs.map((x, i) => ({ x, y: ys[i] }));
}

describe("pearson", () => {
  it("is 1 on a perfect increasing line", () => {
    expect(pearson(pairs([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]))).toBeCloseTo(1, 10);
  });

  it("is -1 on a perfect decreasing line", () => {
    expect(pearson(pairs([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]))).toBeCloseTo(-1, 10);
  });

  it("is ~0 on a hand-picked set with no linear trend", () => {
    // x increases steadily; y is symmetric around its mean with no consistent trend.
    const r = pearson(pairs([1, 2, 3, 4], [1, 4, 4, 1]));
    expect(r).not.toBeNull();
    expect(r as number).toBeCloseTo(0, 10);
  });

  it("is null when x has zero variance", () => {
    expect(pearson(pairs([3, 3, 3, 3], [1, 2, 3, 4]))).toBeNull();
  });

  it("is null when y has zero variance", () => {
    expect(pearson(pairs([1, 2, 3, 4], [5, 5, 5, 5]))).toBeNull();
  });

  it("is null with fewer than 2 pairs", () => {
    expect(pearson([])).toBeNull();
    expect(pearson([{ x: 1, y: 1 }])).toBeNull();
  });
});

function emptyInput(): InsightsInput {
  return { workVsSpike: [], walkingVsNextMorning: [], sleepVsPain: [] };
}

describe("computeInsights", () => {
  it("reports insufficient data with the pair count below 5", () => {
    const input = emptyInput();
    input.workVsSpike = pairs([1, 2, 3], [1, 2, 3]);
    const [work] = computeInsights(input);
    expect(work.strength).toBe("insufficient");
    expect(work.n).toBe(3);
    expect(work.sentence).toContain("3");
    expect(work.sentence).toContain("5");
  });

  it("reports no clear link when |r| < 0.5", () => {
    const input = emptyInput();
    // weakly related, r should land below 0.5
    input.sleepVsPain = pairs([1, 2, 3, 4, 5, 6], [5, 1, 5, 1, 5, 1]);
    const insights = computeInsights(input);
    const sleep = insights.find((i) => i.key === "sleepVsPain")!;
    expect(sleep.strength).toBe("none");
    expect(sleep.sentence.toLowerCase()).toContain("no clear link");
    expect(sleep.sentence).toContain(String(sleep.n));
  });

  it("produces the 'started better' sentence for a strong negative walking correlation", () => {
    const input = emptyInput();
    // more walking (x) → lower next-morning pain (y): perfect negative correlation
    input.walkingVsNextMorning = pairs([10, 20, 30, 40, 50], [8, 6, 4, 2, 0]);
    const [, walking] = computeInsights(input);
    expect(walking.strength).toBe("strong");
    expect(walking.sentence).toMatch(/started better/);
  });

  it("never uses causal language across a mixed fixture", () => {
    const input: InsightsInput = {
      workVsSpike: pairs([2, 3, 4, 5, 6, 7], [3, 4, 5, 6, 7, 8]), // strong positive
      walkingVsNextMorning: pairs([10, 20, 30, 40, 50], [8, 6, 4, 2, 0]), // strong negative
      sleepVsPain: pairs([1, 2, 3, 4, 5, 6], [5, 1, 5, 1, 5, 1]), // no clear link
    };
    const insights: Insight[] = computeInsights(input);
    expect(insights.length).toBe(3);
    for (const insight of insights) {
      expect(insight.sentence.toLowerCase()).not.toContain("causes");
      expect(insight.sentence.toLowerCase()).not.toContain("because");
    }
  });
});
