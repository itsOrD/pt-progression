import { describe, expect, it } from "vitest";
import { archiveEpisode, defaultState, validateState } from "./storage";
import { EMPTY_RED_FLAGS } from "../types";
import type { AppState, DayEntry } from "../types";

function day(dateKey: string, dayNumber: number): DayEntry {
  return {
    date: dateKey,
    dayNumber,
    redFlags: { ...EMPTY_RED_FLAGS },
    completedTaskIds: ["p1-tilts"],
    swaps: {},
    workBlocksCompleted: 1,
  };
}

function stateWithHistory(overrides: Partial<AppState> = {}): AppState {
  const base = defaultState("2026-01-01");
  return {
    ...base,
    days: {
      "2026-01-01": day("2026-01-01", 1),
      "2026-01-02": day("2026-01-02", 2),
    },
    badges: { "first-checkin": "2026-01-01T00:00:00.000Z" },
    extension: { kind: "repeat-stabilize", startedOnDay: 11 },
    graduatedOn: null,
    settings: { vibration: false, sound: true },
    ...overrides,
  };
}

describe("archiveEpisode", () => {
  it("moves the full current run into pastEpisodes as a health record", () => {
    const state = stateWithHistory();
    const next = archiveEpisode(state, "2026-01-10");

    expect(next.pastEpisodes).toHaveLength(1);
    const archived = next.pastEpisodes![0];
    expect(archived.startDate).toBe("2026-01-01");
    expect(archived.endedOn).toBe("2026-01-10");
    expect(archived.days).toEqual(state.days);
    expect(archived.badges).toEqual(state.badges);
    expect(archived.extension).toEqual(state.extension);
    expect(archived.graduatedOn).toBe(state.graduatedOn);
  });

  it("resets the run fields for a fresh episode", () => {
    const state = stateWithHistory({ phaseOverride: 3, graduatedOn: "2026-01-09" });
    const next = archiveEpisode(state, "2026-01-10");

    expect(next.startDate).toBe("2026-01-10");
    expect(next.days).toEqual({});
    expect(next.badges).toEqual({});
    expect(next.extension).toBeNull();
    expect(next.graduatedOn).toBeNull();
    expect(next.phaseOverride).toBeNull();
  });

  it("preserves settings across the archive", () => {
    const state = stateWithHistory({ settings: { vibration: false, sound: true } });
    const next = archiveEpisode(state, "2026-01-10");
    expect(next.settings).toEqual({ vibration: false, sound: true });
  });

  it("appends to any existing pastEpisodes rather than replacing them", () => {
    const priorEpisode = {
      startDate: "2025-12-01",
      endedOn: "2025-12-11",
      days: {},
      badges: {},
      extension: null,
      graduatedOn: "2025-12-11",
    };
    const state = stateWithHistory({ pastEpisodes: [priorEpisode] });
    const next = archiveEpisode(state, "2026-01-10");

    expect(next.pastEpisodes).toHaveLength(2);
    expect(next.pastEpisodes![0]).toEqual(priorEpisode);
    expect(next.pastEpisodes![1].startDate).toBe("2026-01-01");
  });

  it("records a graduated episode's graduatedOn rather than losing it", () => {
    const state = stateWithHistory({ graduatedOn: "2026-01-09" });
    const next = archiveEpisode(state, "2026-01-10");
    expect(next.pastEpisodes![0].graduatedOn).toBe("2026-01-09");
  });
});

describe("validateState — pastEpisodes tolerance", () => {
  const validEpisode = {
    startDate: "2025-12-01",
    endedOn: "2025-12-11",
    days: {},
    badges: {},
    extension: null,
    graduatedOn: null,
  };

  function rawState(pastEpisodes: unknown): unknown {
    return {
      version: 1,
      startDate: "2026-01-01",
      phaseOverride: null,
      days: {},
      badges: {},
      extension: null,
      graduatedOn: null,
      timer: { mode: "idle", endsAt: null, blocksCompletedTotal: 0 },
      settings: { vibration: true, sound: false },
      lastSavedAt: null,
      pastEpisodes,
    };
  }

  it("loads unchanged when pastEpisodes is absent (pre-existing saves)", () => {
    const raw = rawState(undefined);
    delete (raw as { pastEpisodes?: unknown }).pastEpisodes;
    const result = validateState(raw);
    expect(result).not.toBeNull();
    expect(result!.pastEpisodes).toBeUndefined();
  });

  it("keeps a well-formed pastEpisodes array", () => {
    const result = validateState(rawState([validEpisode]));
    expect(result!.pastEpisodes).toEqual([validEpisode]);
  });

  it("drops pastEpisodes entirely when it isn't an array", () => {
    const result = validateState(rawState("not-an-array"));
    expect(result!.pastEpisodes).toBeUndefined();
  });

  it("filters out malformed entries but keeps well-formed ones", () => {
    const malformed = [validEpisode, { startDate: 42 }, null, "garbage", {}];
    const result = validateState(rawState(malformed));
    expect(result!.pastEpisodes).toEqual([validEpisode]);
  });

  it("does not require deep-validating archived days within a kept episode", () => {
    const episodeWithOddDays = { ...validEpisode, days: { whatever: "not-validated-deeply" } };
    const result = validateState(rawState([episodeWithOddDays]));
    expect(result!.pastEpisodes).toEqual([episodeWithOddDays]);
  });
});
