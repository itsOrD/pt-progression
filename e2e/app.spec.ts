import { expect, test } from "@playwright/test";
import { freshPage, setSlider } from "./helpers";

test.describe("navigation", () => {
  test("all six tabs render their views", async ({ page }) => {
    await freshPage(page);

    await expect(page.getByTestId("daily-decision")).toBeVisible(); // starts on Today

    await page.getByTestId("nav-overview").click();
    await expect(page.getByTestId("overview-decision")).toBeVisible();
    await expect(page.getByTestId("next-action")).toBeVisible();

    await page.getByTestId("nav-library").click();
    await expect(page.getByTestId("lib-heat-reset")).toBeVisible();

    await page.getByTestId("nav-flow").click();
    await expect(page.getByTestId("flowchart")).toBeVisible();

    await page.getByTestId("nav-progress").click();
    await expect(page.getByTestId("progress-score")).toBeVisible();

    await page.getByTestId("nav-settings").click();
    await expect(page.getByTestId("data-card")).toBeVisible();

    await page.getByTestId("nav-today").click();
    await expect(page.getByTestId("morning-checkin")).toBeVisible();
  });
});

test.describe("sliders and decisions", () => {
  test("green inputs produce ADVANCE and the flowchart highlights it", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 3);
    await setSlider(page, "current-pain", 3);
    await setSlider(page, "abdomen-pressure", 1);

    await expect(page.getByTestId("daily-decision")).toContainText("Advance");

    await page.getByTestId("nav-flow").click();
    await expect(page.getByTestId("flow-advance")).toHaveClass(/terminal-active/);
  });

  test("high pain produces BACK_OFF and regresses the plan", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 4);
    await setSlider(page, "current-pain", 7);
    await expect(page.getByTestId("daily-decision")).toContainText("Back Off");
    // phase 1 is all flare-safe, so nothing is dropped — but doses regress
    await expect(page.getByTestId("todays-plan")).toContainText("Scaled back");
    await expect(page.getByTestId("todays-plan")).toContainText("regressed");

    await page.getByTestId("nav-flow").click();
    await expect(page.getByTestId("flow-back-off")).toHaveClass(/terminal-active/);
  });

  test("pain exactly 5 produces HOLD", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 4);
    await setSlider(page, "current-pain", 5);
    await expect(page.getByTestId("daily-decision")).toContainText("Hold");
  });

  test("red flag forces GET_CHECKED and disables celebration", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 2);
    await page.getByTestId("redflag-saddleNumbness").click();
    await expect(page.getByTestId("daily-decision")).toContainText("Get Checked");

    await page.getByTestId("nav-flow").click();
    await expect(page.getByTestId("flow-get-checked")).toHaveClass(/terminal-active/);
  });

  test("abdominal pressure 7 forces GET_CHECKED", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 2);
    await setSlider(page, "abdomen-pressure", 7);
    await expect(page.getByTestId("daily-decision")).toContainText("Get Checked");
  });
});

test.describe("task completion", () => {
  test("checking tasks updates state and earns the first badge", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 3);
    // first check-in badge fires
    await expect(page.getByTestId("toast")).toContainText("First Check-In");

    const firstCheck = page.locator('[data-testid^="check-"]').first();
    await firstCheck.click();
    await expect(firstCheck).toHaveClass(/checked/);

    await page.getByTestId("nav-overview").click();
    await expect(page.getByTestId("overview-decision")).toBeVisible();
  });

  test("swap replaces an exercise with a same-element alternative", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 3);
    const tiltCard = page.getByTestId("task-p1-tilts");
    await expect(tiltCard).toContainText("Pelvic tilts");
    await page.getByTestId("swap-p1-tilts").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByTestId("swap-option-cat-cow").getByRole("button", { name: "Use this instead" }).click();
    await expect(tiltCard).toContainText("cat–cow");
  });
});

test.describe("persistence", () => {
  test("check-in data and completed tasks survive a reload", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 6);
    await setSlider(page, "current-pain", 6);
    await page.locator('[data-testid^="check-"]').first().click();
    await expect(page.getByTestId("daily-decision")).toContainText("Back Off");

    await page.reload();
    await expect(page.getByTestId("daily-decision")).toContainText("Back Off");
    await expect(page.locator('[data-testid^="check-"]').first()).toHaveClass(/checked/);
  });

  test("URL hash backup restores state when localStorage is wiped", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 6);
    await setSlider(page, "current-pain", 6);
    await expect(page.getByTestId("daily-decision")).toContainText("Back Off");
    // wait for the debounced hash mirror
    await page.waitForFunction(() => location.hash.startsWith("#backup="));

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByTestId("daily-decision")).toContainText("Back Off");
  });
});

test.describe("export / import", () => {
  test("export downloads valid JSON", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 4);
    await page.getByTestId("nav-settings").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-json").click();
    const download = await downloadPromise;
    const path = await download.path();
    const { readFileSync } = await import("node:fs");
    const data = JSON.parse(readFileSync(path!, "utf8"));
    expect(data.version).toBe(1);
    expect(Object.keys(data.days).length).toBeGreaterThan(0);
  });

  test("import replaces state from a JSON file", async ({ page }) => {
    await freshPage(page);
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    const state = {
      version: 1,
      startDate: today,
      phaseOverride: null,
      days: {
        [today]: {
          date: today,
          dayNumber: 1,
          morning: { pain: 7, stiffness: 5, worseThanYesterday: false, sleepQuality: 4 },
          current: { pain: 7, abdomenPressure: 1 },
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
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("import-file").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(state)),
    });
    await expect(page.getByTestId("toast")).toContainText("imported");
    await page.getByTestId("nav-today").click();
    await expect(page.getByTestId("daily-decision")).toContainText("Back Off");
  });

  test("import confirmation plays before a queued badge toast", async ({ page }) => {
    await freshPage(page);
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    // Same fixture shape as "import replaces state": an empty badges map plus
    // a checked-in day means the import also fires the first-checkin badge,
    // which should queue behind the import toast rather than clobber it.
    const state = {
      version: 1,
      startDate: today,
      phaseOverride: null,
      days: {
        [today]: {
          date: today,
          dayNumber: 1,
          morning: { pain: 7, stiffness: 5, worseThanYesterday: false, sleepQuality: 4 },
          current: { pain: 7, abdomenPressure: 1 },
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
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("import-file").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(state)),
    });

    // The import confirmation shows first...
    await expect(page.getByTestId("toast")).toContainText("Data imported");
    // ...and only once it expires (~2.8s) does the queued badge toast play.
    await expect(page.getByTestId("toast")).toContainText("First Check-In", { timeout: 4000 });
  });
});

test.describe("desk timer", () => {
  test("starts, persists across reload, and flips to break after 25 minutes", async ({ page }) => {
    await page.clock.install();
    await freshPage(page);
    await page.getByTestId("timer-start").click();
    await expect(page.getByTestId("timer-display")).toContainText(/^(25:00|24:5\d)$/);

    await page.clock.fastForward("05:00");
    const minutesShown = async () =>
      parseInt((await page.getByTestId("timer-display").innerText()).split(":")[0], 10);
    expect(await minutesShown()).toBeLessThanOrEqual(20);
    expect(await minutesShown()).toBeGreaterThanOrEqual(19);

    // timer state is timestamp-based, so a reload keeps the countdown
    await page.reload();
    await expect(page.getByTestId("timer-display")).toBeVisible();
    expect(await minutesShown()).toBeLessThanOrEqual(20);
    expect(await minutesShown()).toBeGreaterThanOrEqual(18);

    await page.clock.fastForward("20:30");
    await expect(page.getByTestId("timer-skip-break")).toBeVisible();
    await expect(page.getByTestId("blocks-today")).toHaveText("1");
  });

  test("summary generation earns the PT-Ready badge", async ({ page }) => {
    await freshPage(page);
    await setSlider(page, "morning-pain", 3);
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("make-summary").click();
    await expect(page.getByTestId("summary-text")).toContainText("SELF-TRACKING SUMMARY");
    await page.getByTestId("nav-overview").click();
    await expect(page.locator(".badge.earned", { hasText: "PT-Ready Summary" })).toBeVisible();
  });
});
