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
