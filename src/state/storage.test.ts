import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_RED_FLAGS } from "../types";
import { STORAGE_KEY, defaultState, didLastSaveFail, loadState, saveState, validateState, wasStorageCorrupt } from "./storage";

/** Minimal Map-backed stand-in for the Web Storage API, for use in node tests. */
class FakeLocalStorage implements Storage {
  private store = new Map<string, string>();
  private failSetItem = false;

  get length(): number {
    return this.store.size;
  }

  setFailSetItem(fail: boolean): void {
    this.failSetItem = fail;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    if (this.failSetItem) throw new Error("simulated quota/write failure");
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

let fake: FakeLocalStorage;

beforeEach(() => {
  fake = new FakeLocalStorage();
  globalThis.localStorage = fake;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("validateState — per-day sanitization", () => {
  it("drops malformed day entries but keeps well-formed ones", () => {
    const raw = {
      version: 1,
      startDate: "2026-01-01",
      days: {
        "2026-01-01": {
          date: "2026-01-01",
          dayNumber: 1,
          redFlags: {},
          completedTaskIds: ["a"],
          swaps: {},
          workBlocksCompleted: 2,
        },
        "bad-date": { date: "not-a-date", dayNumber: 2 },
        "missing-date": { dayNumber: 3 },
        "missing-day-number": { date: "2026-01-03" },
        "not-an-object": "nope",
      },
    };

    const result = validateState(raw);
    expect(result).not.toBeNull();
    expect(result!.droppedDayCount).toBe(4);
    expect(Object.keys(result!.state.days)).toEqual(["2026-01-01"]);

    const kept = result!.state.days["2026-01-01"];
    expect(kept.completedTaskIds).toEqual(["a"]);
    // Missing redFlags keys are filled in from the empty-red-flags default.
    expect(kept.redFlags).toEqual(EMPTY_RED_FLAGS);
  });

  it("drops individual swap entries whose exerciseId isn't a real exercise", () => {
    const raw = {
      version: 1,
      startDate: "2026-01-01",
      days: {
        "2026-01-01": {
          date: "2026-01-01",
          dayNumber: 1,
          swaps: { "task-a": "heat-reset", "task-b": "totally-made-up-exercise-id" },
        },
      },
    };

    const result = validateState(raw)!;
    const day = result.state.days["2026-01-01"];
    expect(day.swaps).toEqual({ "task-a": "heat-reset" });
  });
});

describe("loadState — corruption handling", () => {
  it("returns null and preserves the raw string under a recovery key when unreadable", () => {
    fake.setItem(STORAGE_KEY, "{not valid json at all");

    const result = loadState();

    expect(result).toBeNull();
    expect(wasStorageCorrupt()).toBe(true);
    const recoveryKeys = fake.keys().filter((k) => k.startsWith(`${STORAGE_KEY}.corrupt-`));
    expect(recoveryKeys).toHaveLength(1);
    expect(fake.getItem(recoveryKeys[0])).toBe("{not valid json at all");
  });

  it("treats no saved data at all as not corrupt", () => {
    const result = loadState();
    expect(result).toBeNull();
    expect(wasStorageCorrupt()).toBe(false);
  });
});

describe("saveState — write failure", () => {
  it("signals failure and leaves lastSavedAt untouched when setItem throws", () => {
    const state = defaultState("2026-01-01");
    fake.setFailSetItem(true);

    const result = saveState(state);

    expect(didLastSaveFail()).toBe(true);
    expect(result.lastSavedAt).toBe(state.lastSavedAt);
    expect(fake.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clears the failure flag on a subsequent successful save", () => {
    fake.setFailSetItem(true);
    saveState(defaultState("2026-01-01"));
    expect(didLastSaveFail()).toBe(true);

    fake.setFailSetItem(false);
    const result = saveState(defaultState("2026-01-01"));
    expect(didLastSaveFail()).toBe(false);
    expect(result.lastSavedAt).not.toBeNull();
  });
});
