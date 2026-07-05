import type { AppState } from "../types";
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
