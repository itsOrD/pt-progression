import type { AppState } from "../types";
import { Card } from "../ui/bits";
import { DECISION_META } from "../ui/charts";
import { decisionFor } from "../state/selectors";

type NodeDef = {
  id: string;
  text: string;
  kind: "start" | "gate" | "terminal";
  yes?: string; // terminal reached on "yes"
  color?: string;
};

const NODES: NodeDef[] = [
  { id: "checkin", text: "Daily check-in", kind: "start" },
  { id: "redflag-gate", text: "Red flags, or abdominal pressure ≥ 7?", kind: "gate", yes: "get-checked" },
  { id: "get-checked", text: "🩺 GET CHECKED", kind: "terminal", color: "var(--critical)" },
  {
    id: "backoff-gate",
    text: "Pain ≥ 6, spike ≥ 8, symptoms spreading, exercise flare lasting 1h+, or worse next morning?",
    kind: "gate",
    yes: "back-off",
  },
  { id: "back-off", text: "⛅ BACK OFF", kind: "terminal", color: "var(--serious)" },
  {
    id: "hold-gate",
    text: "Spike 7, pain 5, abdominal pressure 4–6, completion < 50%, or tolerance flat 2 days?",
    kind: "gate",
    yes: "hold",
  },
  { id: "hold", text: "⏸️ HOLD", kind: "terminal", color: "var(--warning)" },
  {
    id: "advance-gate",
    text: "Pain ≤ 4, spike ≤ 6, abdominal pressure ≤ 3, completion ≥ 66%, no next-morning worsening?",
    kind: "gate",
    yes: "advance",
  },
  { id: "advance", text: "🟢 ADVANCE", kind: "terminal", color: "var(--good)" },
  { id: "do-minimum", text: "🌗 DO MINIMUM", kind: "terminal", color: "var(--accent-deep)" },
];

export function FlowchartView(props: { state: AppState; todayKey: string }) {
  const result = decisionFor(props.state, props.todayKey);
  const path = result.flowPath;
  const active = (id: string) => path.includes(id);
  const meta = DECISION_META[result.decision];

  return (
    <>
      <Card title="🧭 Why the app decided this">
        <p className="secondary" style={{ marginTop: 0 }}>
          Today's path is highlighted. Decision: <strong>{meta.label}</strong>
          {result.reasons.length > 0 && <> — {result.reasons.join("; ")}</>}
        </p>
      </Card>

      <Card testId="flowchart">
        {NODES.map((node) => {
          if (node.kind === "terminal" && node.id !== "do-minimum") {
            return null; // terminals render beside their gate below
          }
          if (node.kind === "start") {
            return (
              <div key={node.id}>
                <div className={`flow-node ${active(node.id) ? "active" : ""}`} data-testid={`flow-${node.id}`}>
                  {node.text}
                </div>
                <div className={`flow-arrow ${active("redflag-gate") ? "active" : ""}`}>▼</div>
              </div>
            );
          }
          if (node.kind === "gate") {
            const terminal = NODES.find((n) => n.id === node.yes)!;
            const gateActive = active(node.id);
            const tookYes = active(terminal.id);
            const next = nextGateAfter(node.id);
            return (
              <div key={node.id}>
                <div className="flow-branch">
                  <div className={`flow-node gate ${gateActive ? "active" : ""}`} data-testid={`flow-${node.id}`}>
                    {node.text}
                  </div>
                  <div>
                    <div className={`flow-arrow ${tookYes ? "active" : ""}`}>yes ▶</div>
                    <div
                      className={`flow-node ${tookYes ? "active terminal-active" : ""}`}
                      style={tookYes ? { background: terminal.color } : undefined}
                      data-testid={`flow-${terminal.id}`}
                    >
                      {terminal.text}
                    </div>
                  </div>
                </div>
                {next && (
                  <div className={`flow-arrow ${gateActive && !tookYes ? "active" : ""}`}>no ▼</div>
                )}
              </div>
            );
          }
          // do-minimum: the fall-through terminal of the advance gate
          const isActive = active(node.id);
          return (
            <div key={node.id}>
              <div
                className={`flow-node ${isActive ? "active terminal-active" : ""}`}
                style={isActive ? { background: node.color } : undefined}
                data-testid={`flow-${node.id}`}
              >
                {node.text} <span style={{ fontWeight: 400 }}>(pain OK but the day fell short)</span>
              </div>
            </div>
          );
        })}
      </Card>

      <Card title="Beyond Day 10">
        <p className="secondary" style={{ marginTop: 0 }}>
          At Day 10 a second check runs: <strong>Graduate</strong> needs 3 green days in a row, pain
          ≤ 2, spikes ≤ 4, abdominal pressure ≤ 2, sitting ≥ 90 min and walking ≥ 30 min. Improving
          but short of that → <strong>Extend 7 days</strong> from the last tolerated phase. Not
          improving, spikes staying ≥ 7, pressure staying ≥ 4, or repeated Back-Offs →{" "}
          <strong>see a PT/doctor</strong> with the exported summary.
        </p>
      </Card>
    </>
  );
}

function nextGateAfter(id: string): string | null {
  const order = ["redflag-gate", "backoff-gate", "hold-gate", "advance-gate"];
  const i = order.indexOf(id);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : id === "advance-gate" ? "do-minimum" : null;
}
