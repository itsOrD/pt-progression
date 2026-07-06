import { useState } from "react";
import type { AppState, DayEntry } from "../types";
import { Card, Modal } from "../ui/bits";
import { DayEditor } from "../ui/DayEditor";
import { DecisionStrip, SparkRow } from "../ui/charts";
import { decisionHistory, scoreFor, sortedDayEntries } from "../state/selectors";
import { phaseForDay } from "../data/plan";
import { completionPct } from "../engine/adjust";

type Props = {
  state: AppState;
  todayKey: string;
  updateDay: (dateKey: string, fn: (d: DayEntry) => DayEntry) => void;
};

export function ProgressView({ state, todayKey, updateDay }: Props) {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const entries = sortedDayEntries(state);
  const score = scoreFor(state, todayKey);
  const history = decisionHistory(state);
  const editingDay = editingDate ? entries.find((d) => d.date === editingDate) : undefined;

  const completions = entries.map((d) => {
    const plan = phaseForDay(d.dayNumber, state.phaseOverride);
    return Math.round(completionPct(plan.tasks.map((t) => t.taskId), d.completedTaskIds));
  });

  return (
    <>
      <Card title={`🧭 Recovery score: ${score.score}/100`} testId="progress-score">
        <p className="secondary" style={{ marginTop: 0 }}>
          <strong>{score.label}.</strong> {score.explanation}
        </p>
        <table className="plain">
          <thead>
            <tr>
              <th>Component</th>
              <th>Points</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {score.components.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td>
                  {c.points}/{c.max}
                </td>
                <td className="muted">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="📈 All trends">
        <SparkRow label="Morning pain" values={entries.map((d) => d.morning?.pain ?? null)} max={10} lowerIsBetter />
        <SparkRow label="Pain now (daily)" values={entries.map((d) => d.current?.pain ?? null)} max={10} lowerIsBetter />
        <SparkRow label="Worst spike" values={entries.map((d) => d.evening?.worstSpike ?? null)} max={10} lowerIsBetter />
        <SparkRow label="Abdominal pressure" values={entries.map((d) => d.current?.abdomenPressure ?? null)} max={10} lowerIsBetter />
        <SparkRow label="Completion %" values={completions} max={100} unit="%" />
        <SparkRow label="Walking done (min)" values={entries.map((d) => d.evening?.walkingMinutesCompleted ?? null)} />
        <SparkRow label="Sitting tolerance (min)" values={entries.map((d) => d.evening?.sittingToleranceMinutes ?? null)} />
        <SparkRow label="Standing tolerance (min)" values={entries.map((d) => d.evening?.standingToleranceMinutes ?? null)} />
        <SparkRow label="Work blocks" values={entries.map((d) => d.workBlocksCompleted)} />
      </Card>

      <Card title="🗂️ Decision history">
        <DecisionStrip history={history} />
      </Card>

      <Card title="📋 Raw data (no fake confidence)">
        <div style={{ overflowX: "auto" }}>
          <table className="plain" data-testid="raw-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>AM</th>
                <th>Now</th>
                <th>Spike</th>
                <th>Abd</th>
                <th>Done</th>
                <th>Walk</th>
                <th>Sit</th>
                <th>Blocks</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((d, i) => (
                <tr
                  key={d.date}
                  className="editable-row"
                  onClick={() => setEditingDate(d.date)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Edit day ${d.dayNumber}`}
                  data-testid={`edit-day-${d.dayNumber}`}
                  onKeyDown={(e) => {
                    // Space's default action scrolls the page — suppress it (and Enter's,
                    // for consistency) before treating the key as an "open editor" activation.
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditingDate(d.date);
                    }
                  }}
                >
                  <td>
                    {d.dayNumber} <span className="muted">{d.date.slice(5)}</span> <span aria-hidden>✏️</span>
                  </td>
                  <td>{d.morning?.pain ?? "—"}</td>
                  <td>{d.current?.pain ?? "—"}</td>
                  <td>{d.evening?.worstSpike ?? "—"}</td>
                  <td>{d.current?.abdomenPressure ?? "—"}</td>
                  <td>{completions[i]}%</td>
                  <td>{d.evening?.walkingMinutesCompleted ?? "—"}</td>
                  <td>{d.evening?.sittingToleranceMinutes ?? "—"}</td>
                  <td>{d.workBlocksCompleted}</td>
                  <td>{d.decision ?? "—"}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={10} className="muted">
                    Nothing logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Tap a row to fix a mislogged entry — decisions recompute from the corrected data.
        </p>
      </Card>

      {editingDay && (
        <Modal title={`Edit Day ${editingDay.dayNumber} (${editingDay.date})`} onClose={() => setEditingDate(null)}>
          <DayEditor day={editingDay} onEdit={(fn) => updateDay(editingDay.date, fn)} />
        </Modal>
      )}
    </>
  );
}
