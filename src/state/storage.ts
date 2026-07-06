import type { AppState, CurrentCheckin, DayEntry, Decision, EveningReview, MorningCheckin, RedFlags } from "../types";
import { EMPTY_RED_FLAGS } from "../types";
import { EXERCISES } from "../data/exercises";
import { toDateKey } from "./selectors";

export const STORAGE_KEY = "pt-progression-v1";
export const HASH_PREFIX = "#backup=";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Sanitize one raw day entry. Hard requirements (a real date + numeric day
 * number) must hold or the entry is dropped entirely — everything else is a
 * soft field that gets repaired to a safe default rather than trusted as-is.
 * This is the thing standing between a corrupted localStorage/import blob and
 * a white screen (e.g. a swap pointing at an exerciseId that no longer
 * exists, which makes getExercise() throw deep inside rendering).
 */
function sanitizeDayEntry(raw: unknown, key: string): DayEntry | null {
  if (!isPlainObject(raw)) {
    console.warn(`validateState: dropping day entry "${key}" — not an object`);
    return null;
  }
  const { date, dayNumber } = raw;
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    console.warn(`validateState: dropping day entry "${key}" — invalid or missing date`);
    return null;
  }
  if (typeof dayNumber !== "number" || !Number.isFinite(dayNumber)) {
    console.warn(`validateState: dropping day entry "${key}" — invalid or missing dayNumber`);
    return null;
  }

  const redFlags: RedFlags = {
    ...EMPTY_RED_FLAGS,
    ...(isPlainObject(raw.redFlags) ? (raw.redFlags as Partial<RedFlags>) : {}),
  };

  const completedTaskIds = Array.isArray(raw.completedTaskIds)
    ? raw.completedTaskIds.filter((id): id is string => typeof id === "string")
    : [];

  const swaps: Record<string, string> = {};
  if (isPlainObject(raw.swaps)) {
    for (const [taskId, exerciseId] of Object.entries(raw.swaps)) {
      if (typeof exerciseId === "string" && exerciseId in EXERCISES) {
        swaps[taskId] = exerciseId;
      } else {
        console.warn(
          `validateState: dropping swap "${taskId}" on day "${key}" — "${String(exerciseId)}" is not a real exercise id`
        );
      }
    }
  }

  const entry: DayEntry = {
    date,
    dayNumber,
    redFlags,
    completedTaskIds,
    swaps,
    workBlocksCompleted: typeof raw.workBlocksCompleted === "number" ? raw.workBlocksCompleted : 0,
  };
  if (isPlainObject(raw.morning)) entry.morning = raw.morning as MorningCheckin;
  if (isPlainObject(raw.current)) entry.current = raw.current as CurrentCheckin;
  if (isPlainObject(raw.evening)) entry.evening = raw.evening as EveningReview;
  if (typeof raw.noTwistPledgeKept === "boolean") entry.noTwistPledgeKept = raw.noTwistPledgeKept;
  if (typeof raw.decision === "string") entry.decision = raw.decision as Decision;

  return entry;
}

export type ValidationResult = { state: AppState; droppedDayCount: number };

export function validateState(raw: unknown): ValidationResult | null {
  if (!isPlainObject(raw)) return null;
  const s = raw as Partial<AppState> & Record<string, unknown>;
  if (s.version !== 1) return null;
  if (typeof s.startDate !== "string" || !DATE_RE.test(s.startDate)) return null;
  if (!isPlainObject(s.days)) return null;

  let droppedDayCount = 0;
  const days: AppState["days"] = {};
  for (const [key, value] of Object.entries(s.days)) {
    const entry = sanitizeDayEntry(value, key);
    if (entry) {
      days[key] = entry;
    } else {
      droppedDayCount++;
    }
  }
  if (droppedDayCount > 0) {
    console.warn(`validateState: dropped ${droppedDayCount} malformed day entrie(s)`);
  }

  const base = defaultState(s.startDate);
  const state: AppState = {
    ...base,
    ...s,
    days,
    badges: (s.badges as AppState["badges"]) ?? {},
    timer: { ...base.timer, ...(s.timer ?? {}) },
    settings: { ...base.settings, ...(s.settings ?? {}) },
  };
  return { state, droppedDayCount };
}

// ---------------------------------------------------------- corruption flag

/** Whether the most recent loadState() call found data it couldn't trust at all. */
let storageWasCorrupt = false;

export function wasStorageCorrupt(): boolean {
  return storageWasCorrupt;
}

/** Keep the untouched original string around so nothing is silently lost. */
function preserveCorruptRaw(raw: string): void {
  const recoveryKey = `${STORAGE_KEY}.corrupt-${Date.now()}`;
  try {
    localStorage.setItem(recoveryKey, raw);
  } catch (err) {
    console.error("preserveCorruptRaw: failed to preserve unreadable data for recovery", err);
  }
}

export function loadState(): AppState | null {
  storageWasCorrupt = false;
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.error("loadState: failed to read localStorage", err);
    return null;
  }
  if (raw === null) return null; // nothing saved yet — not an error

  try {
    const result = validateState(JSON.parse(raw));
    if (!result) {
      console.error("loadState: stored data failed validation and could not be recovered");
      storageWasCorrupt = true;
      preserveCorruptRaw(raw);
      return null;
    }
    if (result.droppedDayCount > 0) {
      console.warn(`loadState: dropped ${result.droppedDayCount} malformed day entrie(s) while loading`);
    }
    return result.state;
  } catch (err) {
    console.error("loadState: failed to parse stored data", err);
    storageWasCorrupt = true;
    preserveCorruptRaw(raw);
    return null;
  }
}

// -------------------------------------------------------------- save health

/** Whether the most recent saveState() call actually persisted to localStorage. */
let lastSaveFailed = false;

export function didLastSaveFail(): boolean {
  return lastSaveFailed;
}

export function saveState(state: AppState): AppState {
  const stamped = { ...state, lastSavedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    lastSaveFailed = false;
    return stamped;
  } catch (err) {
    console.error("saveState: failed to write to localStorage", err);
    lastSaveFailed = true;
    // Don't lie about when data was saved — return the state unstamped so
    // "last saved" keeps reflecting the last write that actually succeeded.
    return state;
  }
}

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJson(text: string): ValidationResult | null {
  try {
    return validateState(JSON.parse(text));
  } catch (err) {
    console.error("importJson: failed to parse imported file", err);
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
    const result = validateState(JSON.parse(b64decode(hash.slice(HASH_PREFIX.length))));
    if (!result) return null;
    if (result.droppedDayCount > 0) {
      console.warn(`decodeStateFromHash: dropped ${result.droppedDayCount} malformed day entrie(s)`);
    }
    return result.state;
  } catch (err) {
    console.error("decodeStateFromHash: failed to decode URL hash backup", err);
    return null;
  }
}

// ------------------------------------------------------------ hash health

/** Whether the most recent writeHashBackup() call actually updated the URL. */
let hashBackupHealthy = true;

export function isHashBackupHealthy(): boolean {
  return hashBackupHealthy;
}

/** Write a backup of state into the URL hash without adding history entries. */
export function writeHashBackup(state: AppState): void {
  try {
    const url = new URL(window.location.href);
    url.hash = encodeStateToHash(state);
    window.history.replaceState(null, "", url);
    hashBackupHealthy = true;
  } catch (err) {
    // Very large states could exceed URL limits in some browsers.
    console.error("writeHashBackup: failed to mirror state into the URL hash", err);
    hashBackupHealthy = false;
  }
}

export function readHashBackup(): AppState | null {
  try {
    return decodeStateFromHash(decodeURIComponent(window.location.hash));
  } catch (err) {
    console.error("readHashBackup: failed to read URL hash", err);
    return null;
  }
}
