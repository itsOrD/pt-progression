import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, DayEntry, ExtensionKind } from "./types";
import {
  defaultState,
  didLastSaveFail,
  loadState,
  readHashBackup,
  saveState,
  writeHashBackup,
  wasStorageCorrupt,
  STORAGE_KEY,
} from "./state/storage";
import { decisionFor, emptyDay, evaluateBadges, getDay, toDateKey, dayNumberFor } from "./state/selectors";
import { BADGE_MAP } from "./data/badges";
import { OverviewView } from "./views/OverviewView";
import { DailyView } from "./views/DailyView";
import { LibraryView } from "./views/LibraryView";
import { FlowchartView } from "./views/FlowchartView";
import { ProgressView } from "./views/ProgressView";
import { SettingsView } from "./views/SettingsView";

type Tab = "overview" | "today" | "library" | "flow" | "progress" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "today", label: "Today", icon: "✅" },
  { id: "library", label: "Library", icon: "📚" },
  { id: "flow", label: "Flow", icon: "🧭" },
  { id: "progress", label: "Progress", icon: "📈" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

function stripBackupHash(): void {
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url);
}

// React.StrictMode double-invokes useState's lazy initializer in dev. Cache
// the outcome so the confirm() prompt only ever fires once and a second
// invocation can't see a hash the first one already stripped and end up
// silently discarding the user's choice.
let hashRestoreDecision: AppState | undefined;

function initialState(): AppState {
  const stored = loadState();
  if (stored) return stored;
  if (hashRestoreDecision) return hashRestoreDecision;
  const fromHash = readHashBackup();
  if (!fromHash) return (hashRestoreDecision = defaultState());
  const savedLabel = fromHash.lastSavedAt ? new Date(fromHash.lastSavedAt).toLocaleString() : "an earlier session";
  const restore = confirm(`Restore backup found in this link? Last saved ${savedLabel}`);
  // Either way, don't leave the backup sitting in the URL to re-prompt later.
  stripBackupHash();
  return (hashRestoreDecision = restore ? fromHash : defaultState());
}

export default function App() {
  const [state, setStateRaw] = useState<AppState>(initialState);
  const [tab, setTab] = useState<Tab>("today");
  const [toast, setToast] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [saveFailing, setSaveFailing] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayKey = toDateKey(new Date());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const setState = useCallback((fn: (s: AppState) => AppState) => {
    setStateRaw((s) => saveState(fn(s)));
  }, []);

  // One-time notice if what was on this device couldn't be trusted at load.
  useEffect(() => {
    if (wasStorageCorrupt()) {
      showToast(
        "Saved data couldn't be read — an untouched copy was preserved. Import a backup or reset from Settings."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track whether the most recent save actually reached localStorage so we
  // can keep a persistent warning up instead of quietly losing changes.
  useEffect(() => {
    setSaveFailing(didLastSaveFail());
  }, [state]);

  const updateDay = useCallback(
    (dateKey: string, fn: (d: DayEntry) => DayEntry) => {
      setState((s) => {
        const existing = s.days[dateKey] ?? emptyDay(dateKey, dayNumberFor(dateKey, s.startDate));
        return { ...s, days: { ...s.days, [dateKey]: fn(existing) } };
      });
    },
    [setState]
  );

  // Mirror state into the URL hash (backup) shortly after each change.
  useEffect(() => {
    const id = setTimeout(() => writeHashBackup(state), 400);
    return () => clearTimeout(id);
  }, [state]);

  // Keep today's decision recorded on the day entry so history is honest.
  useEffect(() => {
    const day = getDay(state, todayKey);
    const hasData = day.morning || day.current || day.evening;
    if (!hasData) return;
    const decision = decisionFor(state, todayKey).decision;
    if (day.decision !== decision) {
      updateDay(todayKey, (d) => ({ ...d, decision }));
    }
  }, [state, todayKey, updateDay]);

  // Award badges. Celebrations stay quiet on GET_CHECKED days.
  useEffect(() => {
    const newBadges = evaluateBadges(state, todayKey);
    if (newBadges.length === 0) return;
    const serious = decisionFor(state, todayKey).decision === "GET_CHECKED";
    setState((s) => {
      const badges = { ...s.badges };
      for (const id of newBadges) badges[id] = new Date().toISOString();
      return { ...s, badges };
    });
    const first = BADGE_MAP[newBadges[0]];
    if (!serious && first) {
      showToast(`${first.emoji} Badge earned: ${first.name}`);
      setConfetti((c) => c + 1);
      if (state.settings.vibration && "vibrate" in navigator) {
        try {
          navigator.vibrate(60);
        } catch {
          /* not supported */
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, todayKey]);

  const onExtend = (kind: ExtensionKind) => {
    const day = getDay(state, todayKey);
    const phaseByKind: Record<ExtensionKind, number> = {
      "repeat-stabilize": 2,
      "slow-progression": 3,
      "walking-focus": 2,
      "desk-resilience": 2,
      "stability-focus": 3,
    };
    setState((s) => ({
      ...s,
      extension: { kind, startedOnDay: day.dayNumber },
      phaseOverride: phaseByKind[kind],
    }));
    showToast(`Plan extended 7 days (${kind.replace(/-/g, " ")})`);
  };

  const onGraduate = () => {
    setState((s) => ({ ...s, graduatedOn: todayKey }));
    setConfetti((c) => c + 1);
    showToast("🎓 Graduated to maintenance — keep walking!");
  };

  const onReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url);
    setStateRaw(defaultState());
    showToast("All data erased");
  };

  return (
    <>
      <h1 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden>🌀</span> Back PT Flow Tracker
        <span className="muted" style={{ marginLeft: "auto", fontWeight: 400 }}>
          {todayKey}
        </span>
      </h1>

      {saveFailing && (
        <div className="save-warning-banner" role="alert" data-testid="save-warning">
          Changes are not being saved to this device — export your data
        </div>
      )}

      {tab === "overview" && (
        <OverviewView
          state={state}
          todayKey={todayKey}
          onGoToDaily={() => setTab("today")}
          onExtend={onExtend}
          onGraduate={onGraduate}
        />
      )}
      {tab === "today" && (
        <DailyView
          state={state}
          todayKey={todayKey}
          updateDay={updateDay}
          setTimer={(t) => setState((s) => ({ ...s, timer: t }))}
        />
      )}
      {tab === "library" && <LibraryView />}
      {tab === "flow" && <FlowchartView state={state} todayKey={todayKey} />}
      {tab === "progress" && <ProgressView state={state} todayKey={todayKey} />}
      {tab === "settings" && (
        <SettingsView
          state={state}
          todayKey={todayKey}
          setState={setState}
          onReset={onReset}
          showToast={showToast}
          onSummaryGenerated={() =>
            setState((s) =>
              "pt-ready-summary" in s.badges
                ? s
                : { ...s, badges: { ...s.badges, "pt-ready-summary": new Date().toISOString() } }
            )
          }
        />
      )}

      <nav className="bottom-nav" aria-label="Main">
        <div className="nav-inner">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
              data-testid={`nav-${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {toast && (
        <div className="toast" data-testid="toast">
          {toast}
        </div>
      )}
      <Confetti burst={confetti} />
    </>
  );
}

function Confetti({ burst }: { burst: number }) {
  const [pieces, setPieces] = useState<{ id: number; left: number; delay: number; color: string }[]>([]);
  useEffect(() => {
    if (burst === 0) return;
    const colors = ["#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];
    const next = Array.from({ length: 28 }, (_, i) => ({
      id: burst * 100 + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      color: colors[i % colors.length],
    }));
    setPieces(next);
    const id = setTimeout(() => setPieces([]), 2400);
    return () => clearTimeout(id);
  }, [burst]);
  if (pieces.length === 0) return null;
  return (
    <div className="confetti-layer" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s` }}
        />
      ))}
    </div>
  );
}
