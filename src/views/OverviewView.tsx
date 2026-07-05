import type { AppState } from "../types";
import { Card } from "../ui/bits";
import { DECISION_META, ProgressRing, SparkRow } from "../ui/charts";
import { BADGES } from "../data/badges";
import {
  adjustedPlanFor,
  checkinStreak,
  decisionFor,
  forecastFor,
  getDay,
  planStatusFor,
  scoreFor,
  sortedDayEntries,
} from "../state/selectors";
import { completionPct } from "../engine/adjust";
import { PLAN_LENGTH_DAYS } from "../data/plan";

export function OverviewView(props: {
  state: AppState;
  todayKey: string;
  onGoToDaily: () => void;
  onExtend: (kind: import("../types").ExtensionKind) => void;
  onGraduate: () => void;
}) {
  const { state, todayKey } = props;
  const day = getDay(state, todayKey);
  const result = decisionFor(state, todayKey);
  const meta = DECISION_META[result.decision];
  const plan = adjustedPlanFor(state, todayKey);
  const pct = completionPct(plan.tasks.map((t) => t.taskId), day.completedTaskIds);
  const entries = sortedDayEntries(state).slice(-7);
  const score = scoreFor(state, todayKey);
  const status = planStatusFor(state, todayKey);
  const streak = checkinStreak(state, todayKey);
  const serious = result.decision === "GET_CHECKED";
  const forecast = forecastFor(state, todayKey);

  const nextAction = serious
    ? "Contact a clinician about the red-flag answers before continuing the plan."
    : !day.morning
      ? "Do the morning check-in — it sets today's plan."
      : pct < 100
        ? "Open Today and knock out the next task."
        : !day.evening
          ? "Finish with the evening review to lock in today's decision."
          : "Done for today. Tomorrow's morning check-in closes the loop.";

  return (
    <>
      <div className={`decision-banner decision-${result.decision}`} data-testid="overview-decision">
        <h2>
          {meta.icon} Day {Math.max(1, day.dayNumber)} of {PLAN_LENGTH_DAYS}
          {state.extension ? " (+7 extension)" : ""} · {plan.phase.name} phase
        </h2>
        <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>Decision: {meta.label}</div>
        <div style={{ fontSize: "0.85rem", marginTop: 4 }}>{meta.blurb}</div>
      </div>

      {state.graduatedOn && (
        <Card title="🎓 Maintenance mode">
          <p className="secondary" style={{ margin: 0 }}>
            Graduated on {state.graduatedOn}. Keep the maintenance circuit and the walking habit —
            walking 3–5×/week is the strongest recurrence protection we have evidence for.
          </p>
        </Card>
      )}

      <Card title="➡️ Next action">
        <p style={{ margin: 0 }} data-testid="next-action">
          {nextAction}
        </p>
        <button className="primary-btn" style={{ marginTop: 10 }} onClick={props.onGoToDaily}>
          Open Today
        </button>
      </Card>

      <Card title="📊 Today at a glance">
        <div className="row spread">
          <ProgressRing pct={pct} label="Completion" />
          <div style={{ flex: 1, minWidth: 140 }}>
            <div className="secondary">Task completion</div>
            <div className="muted">
              {plan.tasks.filter((t) => day.completedTaskIds.includes(t.taskId)).length} of{" "}
              {plan.tasks.length} tasks
            </div>
            <div className="streak-row" style={{ marginTop: 8 }} aria-label={`Check-in streak: ${streak} days`}>
              {Array.from({ length: Math.max(streak, 5) }).slice(0, 10).map((_, i) => (
                <span key={i} className={`streak-dot ${i < streak ? "lit" : ""}`} />
              ))}
              <span className="muted">{streak}-day check-in streak</span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="📈 Trends (last 7 logged days)">
        <SparkRow label="Pain now" values={entries.map((d) => d.current?.pain ?? d.morning?.pain ?? null)} max={10} lowerIsBetter />
        <SparkRow label="Worst spike" values={entries.map((d) => d.evening?.worstSpike ?? null)} max={10} lowerIsBetter />
        <SparkRow label="Abdominal pressure" values={entries.map((d) => d.current?.abdomenPressure ?? null)} max={10} lowerIsBetter />
        <SparkRow label="Walking done (min)" values={entries.map((d) => d.evening?.walkingMinutesCompleted ?? null)} />
        <SparkRow label="Sitting tolerance (min)" values={entries.map((d) => d.evening?.sittingToleranceMinutes ?? null)} />
      </Card>

      <Card title={`🧭 Recovery score: ${score.score}/100 — ${score.label}`} testId="recovery-score">
        <p className="secondary" style={{ marginTop: 0 }}>
          {score.explanation}
        </p>
      </Card>

      {!state.graduatedOn && !serious && status.kind === "continue" && day.dayNumber >= 3 && (
        <Card title="🛫 Graduation runway" testId="runway-card">
          {!forecast.enoughData ? (
            <p className="muted" style={{ margin: 0 }}>
              Too early to project — keep logging (needs 3+ days of check-ins).
            </p>
          ) : (
            <>
              <p className="secondary" style={{ marginTop: 0 }} data-testid="runway-met-count">
                {forecast.metCount} of {forecast.totalCount} criteria met
              </p>
              <table className="plain">
                <tbody>
                  {forecast.criteria.map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td className="muted">
                        {c.met
                          ? "met ✓"
                          : c.projectedDay !== null
                            ? `${c.current} now → ${c.target} target · ≈ Day ${c.projectedDay}`
                            : `${c.current ?? "—"} now → ${c.target} target · no clear trend yet`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {forecast.projectedReadyDay !== null && (
                <p className="secondary" data-testid="runway-summary">
                  At the current pace the numeric criteria line up around Day {forecast.projectedReadyDay} —
                  graduation is possible from Day 10.
                </p>
              )}
              <p className="muted" style={{ marginBottom: 0 }}>
                Straight-line guess from a few noisy points — your body doesn't do linear.
              </p>
            </>
          )}
        </Card>
      )}

      {!serious && status.kind === "extend" && (
        <Card title="📆 Should you extend?" testId="extend-card">
          <p className="secondary" style={{ marginTop: 0 }}>
            You've reached Day {day.dayNumber} without meeting graduation criteria, but the trend is
            improving. {status.reasons.join(" ")}
          </p>
          <button className="primary-btn" data-testid="accept-extension" onClick={() => props.onExtend(status.extensionKind)}>
            Extend 7 days ({status.extensionKind.replace(/-/g, " ")})
          </button>
        </Card>
      )}

      {!serious && status.kind === "graduate" && !state.graduatedOn && (
        <Card title="🎓 Ready to graduate" testId="graduate-card">
          <p className="secondary" style={{ marginTop: 0 }}>
            All criteria met: {status.result.metCriteria.join("; ")}.
          </p>
          <button className="primary-btn" data-testid="accept-graduation" onClick={props.onGraduate}>
            Graduate to maintenance
          </button>
        </Card>
      )}

      {status.kind === "formal-help" && (
        <Card title="🩺 Consider a PT or your doctor" testId="formal-help-card">
          <p className="secondary" style={{ marginTop: 0 }}>
            By the numbers, this plan isn't moving things enough on its own:
          </p>
          <ul className="secondary">
            {status.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p className="muted">
            The Settings tab can generate a summary to bring to the appointment. Physical therapists
            treat exactly this presentation — it's the evidence-based next step, not a failure.
          </p>
        </Card>
      )}

      <Card title="🏅 Badges">
        <div className="badge-grid">
          {BADGES.map((b) => {
            const earned = b.id in state.badges;
            return (
              <div key={b.id} className={`badge ${earned ? "earned" : ""}`} title={b.description}>
                <span className="emoji">{b.emoji}</span>
                {b.name}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
