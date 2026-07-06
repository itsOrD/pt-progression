import type { Page } from "@playwright/test";

/** Set a React-controlled range input, triggering React's onChange. */
export async function setSlider(page: Page, testId: string, value: number): Promise<void> {
  await page.getByTestId(testId).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const fire = (val: number) => {
      setter.call(input, String(val));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    // React dedupes same-value sets, so route through a neighboring value first.
    if (input.value === String(v)) {
      const min = Number(input.min || 0);
      fire(v > min ? v - Number(input.step || 1) : v + Number(input.step || 1));
    }
    fire(v);
  }, value);
}

export async function freshPage(page: Page): Promise<void> {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.goto("./", { waitUntil: "load" });
  // hash may still hold an old backup from a previous test's replaceState
  await page.evaluate(() => {
    localStorage.clear();
    history.replaceState(null, "", location.pathname);
  });
  await page.reload();
}

/**
 * Seed a morning check-in for the calendar day before today, so the daily
 * view's pain-trend callout has something to compare today's slider against.
 * Call after freshPage(); reloads the page so App picks up the seeded state.
 */
export async function seedYesterdayMorningPain(page: Page, pain: number): Promise<void> {
  await page.evaluate((p) => {
    const toKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toKey(yesterday);
    const state = {
      version: 1,
      startDate: toKey(today),
      phaseOverride: null,
      days: {
        [yesterdayKey]: {
          date: yesterdayKey,
          dayNumber: 0,
          morning: { pain: p, stiffness: 3, worseThanYesterday: false, sleepQuality: 5 },
          redFlags: {
            legWeakness: false,
            saddleNumbness: false,
            troubleWalking: false,
            bladderBowelChange: false,
            troubleStartingUrine: false,
            feverChills: false,
            vomiting: false,
            bloodUrineStool: false,
            worseningAbdominalPain: false,
          },
          completedTaskIds: [],
          swaps: {},
          workBlocksCompleted: 0,
        },
      },
      badges: {},
      extension: null,
      graduatedOn: null,
      timer: { mode: "idle", endsAt: null, blocksCompletedTotal: 0 },
      settings: { vibration: true, sound: false },
      lastSavedAt: null,
    };
    localStorage.setItem("pt-progression-v1", JSON.stringify(state));
  }, pain);
  await page.reload();
}
