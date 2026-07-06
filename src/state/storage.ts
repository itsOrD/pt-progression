import type { AppState, PastEpisode } from "../types";
import { toDateKey } from "./selectors";

export const STORAGE_KEY = "pt-progression-v1";
export const HASH_PREFIX = "#backup=";

export function defaultState(todayKey?: string): AppState {
  return {
    version: 1,
    startDate: todayKey ?? toDateKey(new Date()),
    phaseOverride: null,
    days: {},
    badges: {},
    extension: null,
    graduatedOn: null,
    timer: { mode: "idle", endsAt: null, blocksCompletedTotal: 0 },
    settings: { vibration: true, sound: false },
    lastSavedAt: null,
  };
}

/**
 * Tolerate a malformed pastEpisodes field the same shallow way the rest of
 * this function tolerates a malformed timer/settings — drop what's clearly
 * broken rather than rejecting the whole backup. We do NOT deep-validate
 * every archived day; each episode just needs to be an object with a
 * string startDate to be kept as a health record.
 */
function sanitizePastEpisodes(raw: unknown): PastEpisode[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const kept = raw.filter(
    (e): e is PastEpisode => !!e && typeof e === "object" && typeof (e as PastEpisode).startDate === "string"
  );
  return kept;
}

export function validateState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<AppState>;
  if (s.version !== 1) return null;
  if (typeof s.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.startDate)) return null;
  if (!s.days || typeof s.days !== "object") return null;
  const base = defaultState(s.startDate);
  return {
    ...base,
    ...s,
    days: s.days as AppState["days"],
    badges: (s.badges as AppState["badges"]) ?? {},
    timer: { ...base.timer, ...(s.timer ?? {}) },
    settings: { ...base.settings, ...(s.settings ?? {}) },
    pastEpisodes: sanitizePastEpisodes(s.pastEpisodes),
  };
}

/**
 * Start a new episode without losing the old one. Relapse is the realistic
 * long-term path for back pain, so "Reset" (destroy everything) shouldn't be
 * the only option for a returning user — archive the full run as a health
 * record instead. Settings and prior episodes carry forward; everything
 * about the run itself (days, badges, extension, graduation, phase override,
 * timer) resets fresh, same as a brand-new install.
 */
export function archiveEpisode(state: AppState, todayKey: string): AppState {
  const archived: PastEpisode = {
    startDate: state.startDate,
    endedOn: todayKey,
    days: state.days,
    badges: state.badges,
    extension: state.extension,
    graduatedOn: state.graduatedOn,
  };
  return {
    ...defaultState(todayKey),
    settings: state.settings,
    pastEpisodes: [...(state.pastEpisodes ?? []), archived],
  };
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return validateState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state: AppState): AppState {
  const stamped = { ...state, lastSavedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
  } catch {
    // localStorage full or unavailable — the in-memory state still works.
  }
  return stamped;
}

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJson(text: string): AppState | null {
  try {
    return validateState(JSON.parse(text));
  } catch {
    return null;
  }
}

// --------------------------------------------------------------- URL hash

/** Unicode-safe base64. */
function b64encode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

function b64decode(s: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}

export function encodeStateToHash(state: AppState): string {
  return HASH_PREFIX + b64encode(JSON.stringify(state));
}

export function decodeStateFromHash(hash: string): AppState | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    return validateState(JSON.parse(b64decode(hash.slice(HASH_PREFIX.length))));
  } catch {
    return null;
  }
}

/** Write a backup of state into the URL hash without adding history entries. */
export function writeHashBackup(state: AppState): void {
  try {
    const url = new URL(window.location.href);
    url.hash = encodeStateToHash(state);
    window.history.replaceState(null, "", url);
  } catch {
    // Very large states could exceed URL limits in some browsers; ignore.
  }
}

export function readHashBackup(): AppState | null {
  try {
    return decodeStateFromHash(decodeURIComponent(window.location.hash));
  } catch {
    return null;
  }
}
