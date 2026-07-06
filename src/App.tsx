import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, DayEntry, ExtensionKind } from "./types";
import { defaultState, loadState, readHashBackup, saveState, writeHashBackup, STORAGE_KEY } from "./state/storage";
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

function initialState(): AppState {
  const stored = loadState();
  if (stored) return stored;
  const fromHash = readHashBackup();
  if (fromHash) return fromHash;
  return defaultState();
}

export default function App() {
  const [state, setStateRaw] = useState<AppState>(initialState);
  const [tab, setTab] = useState<Tab>("today");
  const [toast, setToast] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pending toasts wait their turn instead of clobbering whatever is
  // currently on screen (e.g. an import confirmation followed by a badge).
  const toastQueue = useRef<string[]>([]);
  const todayKey = toDateKey(new Date());

  const advanceToast = useCallback(() => {
    const next = toastQueue.current.shift();
    setToast(next ?? null);
    toastTimer.current = next === undefined ? null : setTimeout(advanceToast, 2800);
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      if (toastTimer.current === null) {
        setToast(msg);
        toastTimer.current = setTimeout(advanceToast, 2800);
        return;
      }
      // Cap the backlog so a burst of events can't queue forever; drop the
      // oldest still-waiting toast to make room for the newest one.
      if (toastQueue.current.length >= 4) toastQueue.current.shift();
      toastQueue.current.push(msg);
    },
    [advanceToast]
  );

  // Clear any pending toast timer/backlog on unmount so a burst of queued
  // toasts can't keep calling setState after the component is gone.
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastQueue.current = [];
    },
    []
  );

  const setState = useCallback((fn: (s: AppState) => AppState) => {
    setStateRaw((s) => saveState(fn(s)));
  }, []);

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
    // Flush any queued/showing celebratory toasts first so a stale "Badge
    // earned" can't play alongside (or after) the erase confirmation.
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
    toastQueue.current = [];
    setToast(null);

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
