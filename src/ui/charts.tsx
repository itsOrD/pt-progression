import { useState } from "react";
import type { Decision } from "../types";

/** Single-series sparkline. Direct-labeled by the surrounding row; no legend needed. */
export function Sparkline(props: {
  values: (number | null)[];
  max?: number;
  width?: number;
  height?: number;
  /** true when lower values are better (pain); flips delta coloring only */
  lowerIsBetter?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = props.width ?? 120;
  const h = props.height ?? 34;
  const pad = 3;
  const vals = props.values;
  const present = vals.filter((v): v is number => v !== null);
  if (present.length === 0) {
    return (
      <svg width={w} height={h} aria-hidden="true">
        <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="var(--grid)" strokeDasharray="3 3" />
      </svg>
    );
  }
  const max = props.max ?? Math.max(...present, 1);
  const x = (i: number) => (vals.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (vals.length - 1));
  const y = (v: number) => h - pad - (Math.min(v, max) / max) * (h - 2 * pad);

  const segments: string[] = [];
  let seg: string[] = [];
  vals.forEach((v, i) => {
    if (v === null) {
      if (seg.length) segments.push(seg.join(" "));
      seg = [];
    } else {
      seg.push(`${seg.length === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    }
  });
  if (seg.length) segments.push(seg.join(" "));

  const lastIdx = vals.reduce((acc, v, i) => (v !== null ? i : acc), -1);

  return (
    <svg
      width={w}
      height={h}
      role="img"
      aria-label={`Trend: ${present.join(", ")}`}
      onMouseLeave={() => setHover(null)}
    >
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--baseline)" strokeWidth={1} />
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />
      ))}
      {vals.map((v, i) =>
        v === null ? null : (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={hover === i ? 4 : i === lastIdx ? 3 : 1.5}
            fill={i === lastIdx || hover === i ? "var(--accent-deep)" : "var(--accent)"}
            stroke="var(--surface-1)"
            strokeWidth={i === lastIdx || hover === i ? 2 : 0}
          />
        )
      )}
      {/* generous hover targets */}
      {vals.map((v, i) =>
        v === null ? null : (
          <rect
            key={`h${i}`}
            x={x(i) - 8}
            y={0}
            width={16}
            height={h}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          >
            <title>{`${v}`}</title>
          </rect>
        )
      )}
    </svg>
  );
}

export function SparkRow(props: {
  label: string;
  values: (number | null)[];
  max?: number;
  unit?: string;
  lowerIsBetter?: boolean;
  testId?: string;
}) {
  const present = props.values.filter((v): v is number => v !== null);
  const last = present.length ? present[present.length - 1] : null;
  const prev = present.length > 1 ? present[present.length - 2] : null;
  const delta = last !== null && prev !== null ? last - prev : null;
  const improving = delta === null ? null : props.lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <div className="spark-card" data-testid={props.testId}>
      <div className="spark-meta">
        <div className="spark-label">{props.label}</div>
        <div className="spark-value">
          {last === null ? "—" : `${last}${props.unit ?? ""}`}
          {delta !== null && delta !== 0 && (
            <span className={`spark-delta ${improving ? "good" : "bad"}`}>
              {" "}
              {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 10) / 10)}
            </span>
          )}
        </div>
      </div>
      <Sparkline values={props.values} max={props.max} lowerIsBetter={props.lowerIsBetter} />
    </div>
  );
}

export function ProgressRing(props: { pct: number; label: string; size?: number }) {
  const size = props.size ?? 84;
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, props.pct));
  return (
    <svg width={size} height={size} role="img" aria-label={`${props.label}: ${Math.round(pct)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--grid)" strokeWidth={7} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size / 4.4}
        fontWeight={700}
        fill="var(--text-primary)"
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

export const DECISION_META: Record<
  Decision,
  { label: string; icon: string; color: string; blurb: string }
> = {
  GET_CHECKED: {
    label: "Get Checked",
    icon: "🩺",
    color: "var(--critical)",
    blurb: "A red-flag answer needs a clinician's eyes before the plan continues.",
  },
  BACK_OFF: {
    label: "Back Off",
    icon: "⛅",
    color: "var(--serious)",
    blurb: "Symptoms are loud today — drop to relief and flare-safe movement. Backing off is a skill, not a failure.",
  },
  HOLD: {
    label: "Hold",
    icon: "⏸️",
    color: "var(--warning)",
    blurb: "Stay at the current level. No progression today; consistency is the win.",
  },
  DO_MINIMUM: {
    label: "Do Minimum",
    icon: "🌗",
    color: "var(--accent-deep)",
    blurb: "Symptoms are OK but completion slipped — do the core tasks at easy doses.",
  },
  ADVANCE: {
    label: "Advance",
    icon: "🟢",
    color: "var(--good)",
    blurb: "Green day — progress the doses and keep the walking going.",
  },
  GRADUATE: {
    label: "Graduate",
    icon: "🎓",
    color: "var(--good)",
    blurb: "Criteria met — move to the maintenance circuit.",
  },
  EXTEND: {
    label: "Extend",
    icon: "📆",
    color: "var(--accent)",
    blurb: "Improving but not done — extend the plan 7 days from the last tolerated phase.",
  },
};

export function DecisionStrip(props: { history: { dayNumber: number; decision: Decision }[] }) {
  return (
    <div className="decision-strip" data-testid="decision-strip">
      {props.history.map((h, i) => {
        const meta = DECISION_META[h.decision];
        return (
          <div className="decision-pip" key={i} title={`Day ${h.dayNumber}: ${meta.label}`}>
            <span className="pip" style={{ background: meta.color }}>
              {meta.icon}
            </span>
            D{h.dayNumber}
          </div>
        );
      })}
      {props.history.length === 0 && <span className="muted">No decisions recorded yet.</span>}
    </div>
  );
}
