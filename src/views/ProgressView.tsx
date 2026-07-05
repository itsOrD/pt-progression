import type { AppState } from "../types";
import { Card } from "../ui/bits";
import { DecisionStrip, SparkRow } from "../ui/charts";
import { decisionHistory, insightsFor, scoreFor, sortedDayEntries } from "../state/selectors";
import { phaseForDay } from "../data/plan";
import { completionPct } from "../engine/adjust";

export function ProgressView(props: { state: AppState; todayKey: string }) {
  const { state, todayKey } = props;
  const entries = sortedDayEntries(state);
  const score = scoreFor(state, todayKey);
  const history = decisionHistory(state);
  const insights = insightsFor(state, todayKey);

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

      <Card title="🔍 Patterns" testId="patterns-card">
        {insights.map((insight) => (
          <p key={insight.key} className="secondary">
            <strong>{insight.label}.</strong> {insight.sentence}
          </p>
        ))}
        <p className="muted">
          Small-sample associations from one person's log — a hint of where to look, never a diagnosis.
        </p>
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
                <tr key={d.date}>
                  <td>
                    {d.dayNumber} <span className="muted">{d.date.slice(5)}</span>
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
      </Card>
    </>
  );
}
