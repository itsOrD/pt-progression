import { useState } from "react";
import type { AppState, DayEntry, EveningReview, RedFlags } from "../types";
import { Card, Slider, Toggle } from "../ui/bits";
import { ExerciseCard } from "../ui/ExerciseCard";
import { DeskTimer } from "../ui/DeskTimer";
import { DECISION_META } from "../ui/charts";
import { RED_FLAG_LABELS } from "../engine/decision";
import { adjustedPlanFor, basePlanFor, decisionFor, getDay } from "../state/selectors";
import { getExercise } from "../data/exercises";

type Props = {
  state: AppState;
  todayKey: string;
  updateDay: (dateKey: string, fn: (d: DayEntry) => DayEntry) => void;
  setTimer: (t: AppState["timer"]) => void;
};

const GROUP_LABELS: Record<string, string> = {
  relief: "🔥 Relief",
  movement: "🚶 Movement & mobility",
  strength: "🧱 Strength & stability",
  desk: "💻 Desk survival",
};

export function DailyView({ state, todayKey, updateDay, setTimer }: Props) {
  const [showBase, setShowBase] = useState(false);
  const day = getDay(state, todayKey);
  const result = decisionFor(state, todayKey);
  const meta = DECISION_META[result.decision];
  const plan = adjustedPlanFor(state, todayKey);
  const base = basePlanFor(state, todayKey);
  const serious = result.decision === "GET_CHECKED";

  const defaultEvening: EveningReview = {
    worstSpike: day.current?.pain ?? day.morning?.pain ?? 3,
    postExercisePainIncrease: 0,
    painStillElevatedAfterOneHour: false,
    symptomsSpread: false,
    sittingToleranceMinutes: 30,
    standingToleranceMinutes: 15,
    walkingToleranceMinutes: 15,
    walkingMinutesCompleted: 0,
    heatUsed: false,
    notes: "",
  };

  const groups = ["relief", "movement", "strength", "desk"] as const;
  const shown = showBase ? base : plan;

  // Desk-break suggestions: desk-survival tasks only — movement tasks include
  // long walks and floor work that don't fit a 90-second break at the desk.
  const breakTasks = plan.tasks
    .filter((t) => t.group === "desk")
    .map((t) => ({
      taskId: t.taskId,
      exerciseId: t.exerciseId,
      name: getExercise(t.exerciseId).name,
      dose: t.dose,
      done: day.completedTaskIds.includes(t.taskId),
    }));

  return (
    <>
      <div className={`decision-banner decision-${result.decision}`} data-testid="daily-decision">
        <h2>
          {meta.icon} Day {day.dayNumber}: {meta.label}
        </h2>
        <div style={{ fontSize: "0.9rem" }}>{meta.blurb}</div>
        {result.reasons.length > 0 && (
          <ul>
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      {serious && (
        <Card title="What to do now">
          <p className="secondary" style={{ margin: 0 }}>
            Contact a clinician (urgent care or your doctor) and describe exactly what you checked
            off. This app pauses everything except gentle relief until then. Bladder/bowel changes,
            saddle numbness, or new leg weakness deserve same-day attention.
          </p>
        </Card>
      )}

      <Card title="🌅 Morning check-in" testId="morning-checkin">
        <Slider
          label="Pain on waking"
          value={day.morning?.pain ?? 3}
          testId="morning-pain"
          onChange={(v) =>
            updateDay(todayKey, (d) => ({
              ...d,
              morning: {
                pain: v,
                stiffness: d.morning?.stiffness ?? 3,
                worseThanYesterday: d.morning?.worseThanYesterday ?? false,
                sleepQuality: d.morning?.sleepQuality ?? 5,
              },
            }))
          }
        />
        {day.morning && (
          <>
            <Slider
              label="Stiffness"
              value={day.morning.stiffness}
              onChange={(v) => updateDay(todayKey, (d) => ({ ...d, morning: { ...d.morning!, stiffness: v } }))}
            />
            <Slider
              label="Sleep quality"
              value={day.morning.sleepQuality}
              onChange={(v) => updateDay(todayKey, (d) => ({ ...d, morning: { ...d.morning!, sleepQuality: v } }))}
            />
            <Toggle
              label="Worse than yesterday morning?"
              checked={day.morning.worseThanYesterday}
              testId="worse-than-yesterday"
              onChange={(v) =>
                updateDay(todayKey, (d) => ({ ...d, morning: { ...d.morning!, worseThanYesterday: v } }))
              }
            />
          </>
        )}
        {!day.morning && <p className="muted">Slide to record pain on waking — the rest appears after.</p>}
      </Card>

      <Card title="⏱️ Right now" testId="current-checkin">
        <Slider
          label="Pain right now"
          value={day.current?.pain ?? day.morning?.pain ?? 3}
          testId="current-pain"
          onChange={(v) =>
            updateDay(todayKey, (d) => ({
              ...d,
              current: { pain: v, abdomenPressure: d.current?.abdomenPressure ?? 0 },
            }))
          }
        />
        <Slider
          label="Deep abdominal pressure"
          value={day.current?.abdomenPressure ?? 0}
          testId="abdomen-pressure"
          onChange={(v) =>
            updateDay(todayKey, (d) => ({
              ...d,
              current: { pain: d.current?.pain ?? d.morning?.pain ?? 3, abdomenPressure: v },
            }))
          }
        />
        <p className="muted" style={{ margin: "4px 0 0" }}>
          That restroom-pressure sensation stays on watch: 4–6 holds the plan, 7+ means get checked.
        </p>
      </Card>

      <Card title="🚩 Red flag check" testId="redflag-card">
        <p className="muted" style={{ marginTop: 0 }}>
          Any of these overrides everything else — no streak is worth ignoring them.
        </p>
        {(Object.keys(RED_FLAG_LABELS) as (keyof RedFlags)[]).map((key) => (
          <Toggle
            key={key}
            label={RED_FLAG_LABELS[key]}
            checked={day.redFlags[key]}
            testId={`redflag-${key}`}
            onChange={(v) =>
              updateDay(todayKey, (d) => ({ ...d, redFlags: { ...d.redFlags, [key]: v } }))
            }
          />
        ))}
      </Card>

      <Card
        title={
          <>
            📋 Today's plan
            <button className="chip-btn" style={{ marginLeft: "auto" }} onClick={() => setShowBase(!showBase)} data-testid="toggle-base-plan">
              {showBase ? "Show adjusted" : "Show base plan"}
            </button>
          </>
        }
        testId="todays-plan"
      >
        <p className="secondary" style={{ marginTop: 0 }}>
          {showBase
            ? `Base ${shown.phase.name}-phase plan at standard doses, before today's adjustment.`
            : shown.note}
        </p>
        {!showBase && plan.droppedTaskIds.length > 0 && (
          <p className="muted">
            Paused today: {plan.droppedTaskIds.map((tid) => {
              const t = base.tasks.find((bt) => bt.taskId === tid);
              return t ? getExercise(t.exerciseId).name : tid;
            }).filter(Boolean).join(", ")}
          </p>
        )}
        {groups.map((g) => {
          const tasks = shown.tasks.filter((t) => t.group === g);
          if (tasks.length === 0) return null;
          return (
            <div key={g} data-testid={`group-${g}`}>
              <h3 style={{ marginTop: 12 }}>{GROUP_LABELS[g]}</h3>
              {tasks.map((task) => (
                <ExerciseCard
                  key={task.taskId}
                  task={task}
                  done={day.completedTaskIds.includes(task.taskId)}
                  decision={result.decision}
                  onToggle={() =>
                    updateDay(todayKey, (d) => ({
                      ...d,
                      completedTaskIds: d.completedTaskIds.includes(task.taskId)
                        ? d.completedTaskIds.filter((t) => t !== task.taskId)
                        : [...d.completedTaskIds, task.taskId],
                    }))
                  }
                  onSwap={(newId) =>
                    updateDay(todayKey, (d) => ({ ...d, swaps: { ...d.swaps, [task.taskId]: newId } }))
                  }
                />
              ))}
            </div>
          );
        })}
      </Card>

      <Card title="💻 Desk timer">
        <DeskTimer
          timer={state.timer}
          blocksToday={day.workBlocksCompleted}
          vibration={state.settings.vibration}
          onTimer={setTimer}
          onBlockComplete={() =>
            updateDay(todayKey, (d) => ({ ...d, workBlocksCompleted: d.workBlocksCompleted + 1 }))
          }
          breakTasks={breakTasks}
          onBreakTaskDone={(taskId) =>
            updateDay(todayKey, (d) =>
              d.completedTaskIds.includes(taskId)
                ? d
                : { ...d, completedTaskIds: [...d.completedTaskIds, taskId] }
            )
          }
        />
        <Toggle
          label="Kept the no-spine-twist pledge today (chair swivel instead)"
          checked={day.noTwistPledgeKept ?? false}
          onChange={(v) => updateDay(todayKey, (d) => ({ ...d, noTwistPledgeKept: v }))}
        />
      </Card>

      <Card title="🌙 Evening review" testId="evening-review">
        {!day.evening && (
          <button
            className="primary-btn"
            data-testid="start-evening-review"
            onClick={() => updateDay(todayKey, (d) => ({ ...d, evening: defaultEvening }))}
          >
            Start evening review
          </button>
        )}
        {day.evening && (
          <EveningForm
            evening={day.evening}
            onChange={(patch) =>
              updateDay(todayKey, (d) => ({ ...d, evening: { ...d.evening!, ...patch } }))
            }
          />
        )}
      </Card>
    </>
  );
}

function EveningForm(props: { evening: EveningReview; onChange: (p: Partial<EveningReview>) => void }) {
  const e = props.evening;
  return (
    <>
      <Slider label="Worst pain spike today" value={e.worstSpike} testId="worst-spike" onChange={(v) => props.onChange({ worstSpike: v })} />
      <Slider
        label="Pain increase right after exercise"
        value={e.postExercisePainIncrease}
        testId="post-exercise-increase"
        onChange={(v) => props.onChange({ postExercisePainIncrease: v })}
      />
      <Toggle
        label="Still elevated 1 hour after exercise?"
        checked={e.painStillElevatedAfterOneHour}
        testId="elevated-after-hour"
        onChange={(v) => props.onChange({ painStillElevatedAfterOneHour: v })}
      />
      <Toggle
        label="Symptoms spread outward or down a leg?"
        checked={e.symptomsSpread}
        testId="symptoms-spread"
        onChange={(v) => props.onChange({ symptomsSpread: v })}
      />
      <Toggle label="Used heat today?" checked={e.heatUsed} onChange={(v) => props.onChange({ heatUsed: v })} />
      <Slider label="Sitting tolerance (min)" value={e.sittingToleranceMinutes} min={0} max={180} step={5} unit="m" testId="sitting-tolerance" onChange={(v) => props.onChange({ sittingToleranceMinutes: v })} />
      <Slider label="Standing tolerance (min)" value={e.standingToleranceMinutes} min={0} max={120} step={5} unit="m" onChange={(v) => props.onChange({ standingToleranceMinutes: v })} />
      <Slider label="Walking tolerance (min)" value={e.walkingToleranceMinutes} min={0} max={60} step={5} unit="m" testId="walking-tolerance" onChange={(v) => props.onChange({ walkingToleranceMinutes: v })} />
      <Slider label="Walking minutes actually done" value={e.walkingMinutesCompleted} min={0} max={90} step={5} unit="m" testId="walking-done" onChange={(v) => props.onChange({ walkingMinutesCompleted: v })} />
      <div style={{ marginTop: 8 }}>
        <label className="secondary" htmlFor="notes">
          Notes (triggers, what helped, anything odd)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={e.notes}
          data-testid="evening-notes"
          onChange={(ev) => props.onChange({ notes: ev.target.value })}
        />
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        Tomorrow's morning check-in ("worse than yesterday?") closes the loop on today's load.
      </p>
    </>
  );
}
