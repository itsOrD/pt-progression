import { useEffect, useRef, useState } from "react";
import type { TimerState } from "../types";
import { ExerciseFigure } from "./ExerciseFigure";
import { pickBreakSuggestion, type BreakTask } from "./breakSuggestion";

export const WORK_MS = 25 * 60 * 1000;
export const BREAK_MS = 90 * 1000;

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type { BreakTask };

export function DeskTimer(props: {
  timer: TimerState;
  blocksToday: number;
  vibration: boolean;
  onTimer: (t: TimerState) => void;
  onBlockComplete: () => void;
  /** Today's desk-survival tasks, offered up round-robin during breaks. */
  breakTasks?: BreakTask[];
  onBreakTaskDone?: (taskId: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const transitioning = useRef(false);

  // Recompute from the wall clock on tab wake — the timer is timestamp-based,
  // so backgrounding Safari for 20 minutes still lands on the right state.
  useEffect(() => {
    const bump = () => setNow(Date.now());
    document.addEventListener("visibilitychange", bump);
    window.addEventListener("focus", bump);
    return () => {
      document.removeEventListener("visibilitychange", bump);
      window.removeEventListener("focus", bump);
    };
  }, []);

  useEffect(() => {
    if (props.timer.mode === "idle") return;
    const id = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(id);
  }, [props.timer.mode]);

  const { mode, endsAt } = props.timer;
  const remaining = endsAt !== null ? endsAt - now : 0;

  useEffect(() => {
    if (mode === "idle" || endsAt === null || remaining > 0 || transitioning.current) return;
    transitioning.current = true;
    const buzz = (pattern: number[]) => {
      if (props.vibration && "vibrate" in navigator) {
        try {
          navigator.vibrate(pattern);
        } catch {
          /* unsupported */
        }
      }
    };
    if (mode === "work") {
      // Block finished → movement break. Anchor the break to the scheduled end
      // so a backgrounded tab doesn't stretch the schedule.
      buzz([120, 60, 120]);
      props.onBlockComplete();
      const base = Math.max(endsAt, Date.now() - BREAK_MS + 1000);
      props.onTimer({
        ...props.timer,
        mode: "break",
        endsAt: base + BREAK_MS,
        blocksCompletedTotal: props.timer.blocksCompletedTotal + 1,
      });
    } else {
      buzz([80]);
      props.onTimer({ ...props.timer, mode: "idle", endsAt: null });
    }
    setTimeout(() => {
      transitioning.current = false;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, endsAt, remaining]);

  const start = () => props.onTimer({ ...props.timer, mode: "work", endsAt: Date.now() + WORK_MS });
  const startBreak = () => props.onTimer({ ...props.timer, mode: "break", endsAt: Date.now() + BREAK_MS });
  const stop = () => props.onTimer({ ...props.timer, mode: "idle", endsAt: null });

  // Rotate through today's desk tasks so repeated breaks don't all suggest the
  // same exercise — starting at the rotation index, take the first not-done
  // task (wrapping) so the "Did it" button is always actionable when shown.
  const breakTasks = props.breakTasks ?? [];
  const startIdx = breakTasks.length === 0 ? 0 : props.timer.blocksCompletedTotal % breakTasks.length;
  const suggestion = pickBreakSuggestion(breakTasks, startIdx);
  const allBreakTasksDone = breakTasks.length > 0 && suggestion === undefined;

  return (
    <div data-testid="desk-timer">
      {mode === "idle" && (
        <>
          <p className="secondary" style={{ marginTop: 0 }}>
            25 minutes of focus, then a 90-second movement break. Your pain builds with sustained
            posture — frequent breaks matter more than perfect posture.
          </p>
          <button className="primary-btn" onClick={start} data-testid="timer-start">
            ▶ Start 25-min work block
          </button>
          <div style={{ height: 8 }} />
          <button className="ghost-btn" onClick={startBreak} data-testid="timer-break-now">
            Take a movement break now
          </button>
        </>
      )}
      {mode === "work" && (
        <>
          <div className="timer-display" data-testid="timer-display">
            {fmt(remaining)}
          </div>
          <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>
            Work block · movement break when it hits zero
          </p>
          <button className="ghost-btn" onClick={stop} data-testid="timer-stop">
            Stop timer
          </button>
        </>
      )}
      {mode === "break" && (
        <>
          <div className="timer-display break" data-testid="timer-display">
            {fmt(remaining)}
          </div>
          {suggestion ? (
            <div className="task-card" data-testid="break-suggestion" aria-live="polite" aria-atomic="true">
              <div className="task-detail" style={{ marginTop: 0 }}>
                <ExerciseFigure exerciseId={suggestion.exerciseId} alt={suggestion.name} size={64} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="task-title" data-testid="break-suggestion-name">
                    {suggestion.name}
                  </div>
                  <div className="task-dose">{suggestion.dose}</div>
                </div>
              </div>
              <button
                className="primary-btn"
                style={{ marginTop: 8 }}
                onClick={() => props.onBreakTaskDone?.(suggestion.taskId)}
                data-testid="break-suggestion-done"
              >
                Did it ✓
              </button>
            </div>
          ) : allBreakTasksDone ? (
            <p className="secondary" style={{ textAlign: "center", marginTop: 0 }} data-testid="break-all-done">
              Desk tasks all done today — stand, stretch, sip water.
            </p>
          ) : (
            <p className="secondary" style={{ textAlign: "center", marginTop: 0 }}>
              Movement break: stand, walk the room, a few pelvic tilts or glute squeezes.
            </p>
          )}
          <button className="primary-btn" onClick={start} data-testid="timer-skip-break">
            Done — start next block
          </button>
          <div style={{ height: 8 }} />
          <button className="ghost-btn" onClick={stop}>
            Stop timer
          </button>
        </>
      )}
      <p className="muted" style={{ marginBottom: 0 }}>
        Blocks completed today: <strong data-testid="blocks-today">{props.blocksToday}</strong>
      </p>
    </div>
  );
}
