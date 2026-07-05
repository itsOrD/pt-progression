import { useState } from "react";
import type { Element } from "../types";
import { EXERCISE_LIST } from "../data/exercises";
import { Card } from "../ui/bits";
import { ExerciseFigure } from "../ui/ExerciseFigure";
import { SOURCE_LIST } from "../data/sources";

type Filter =
  | { kind: "element"; value: Element }
  | { kind: "subtype"; value: "stretch" | "strength" }
  | { kind: "flag"; value: "safe-when-flared" | "avoid-if-spreading" };

const FILTERS: { label: string; filter: Filter }[] = [
  { label: "Relief", filter: { kind: "element", value: "relief" } },
  { label: "Walking/aerobic", filter: { kind: "element", value: "walking" } },
  { label: "Mobility", filter: { kind: "element", value: "mobility" } },
  { label: "Activation", filter: { kind: "element", value: "activation" } },
  { label: "Stability", filter: { kind: "element", value: "stability" } },
  { label: "Functional load", filter: { kind: "element", value: "functional-load" } },
  { label: "Desk reset", filter: { kind: "element", value: "desk-reset" } },
  { label: "Stretch", filter: { kind: "subtype", value: "stretch" } },
  { label: "Strength", filter: { kind: "subtype", value: "strength" } },
  { label: "Safe when flared", filter: { kind: "flag", value: "safe-when-flared" } },
  { label: "Avoid if symptoms spread", filter: { kind: "flag", value: "avoid-if-spreading" } },
];

export function LibraryView() {
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const list = EXERCISE_LIST.filter((ex) => {
    if (!selected) return true;
    const f = FILTERS.find((f) => f.label === selected)!.filter;
    if (f.kind === "element") return ex.element === f.value;
    if (f.kind === "subtype") return ex.subtype === f.value;
    if (f.value === "safe-when-flared") return ex.safeWhenFlared === true;
    return ex.avoidIfSpreading === true;
  });

  return (
    <>
      <Card title="📚 Exercise library">
        <p className="secondary" style={{ marginTop: 0 }}>
          Every exercise here trains a specific element. If one doesn't work for you, swap it for
          another with the same element — the plan cares about the element, not the exercise.
        </p>
        <div className="filter-row">
          <button className={`filter-chip ${selected === null ? "on" : ""}`} onClick={() => setSelected(null)}>
            All ({EXERCISE_LIST.length})
          </button>
          {FILTERS.map((f) => (
            <button
              key={f.label}
              className={`filter-chip ${selected === f.label ? "on" : ""}`}
              data-testid={`filter-${f.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              onClick={() => setSelected(selected === f.label ? null : f.label)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {list.map((ex) => (
        <div className="card" key={ex.id} data-testid={`lib-${ex.id}`}>
          <div className="task-head" onClick={() => setOpen(open === ex.id ? null : ex.id)}>
            <ExerciseFigure exerciseId={ex.id} alt={ex.media[0].alt} size={72} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="task-title">{ex.name}</div>
              <div style={{ margin: "3px 0" }}>
                <span className="tag">{ex.element}</span>
                {ex.subtype && <span className="tag">{ex.subtype}</span>}
                <span className="tag">difficulty {ex.difficulty}/5</span>
                <span className="tag">{ex.irritability} irritability</span>
                {ex.safeWhenFlared && <span className="tag">safe when flared</span>}
                {ex.avoidIfSpreading && <span className="tag">avoid if spreading</span>}
              </div>
              <div className="task-dose">{ex.defaultDose}</div>
            </div>
          </div>
          {open === ex.id && (
            <div style={{ marginTop: 8, fontSize: "0.86rem" }}>
              <div className="why-box">{ex.why}</div>
              <p className="secondary" style={{ marginBottom: 4 }}>
                <strong>Targets:</strong> {ex.targets.join(", ")}
              </p>
              <p className="secondary" style={{ margin: "4px 0" }}>
                <strong>Doses:</strong> min: {ex.minDose} · default: {ex.defaultDose} · progress:{" "}
                {ex.progressDose} · regress: {ex.regressDose}
              </p>
              {ex.doWhen.length > 0 && (
                <p className="secondary" style={{ margin: "4px 0" }}>
                  <strong>Do when:</strong> {ex.doWhen.join("; ")}
                </p>
              )}
              {ex.avoidWhen.length > 0 && (
                <p className="secondary" style={{ margin: "4px 0" }}>
                  <strong>Avoid when:</strong> {ex.avoidWhen.join("; ")}
                </p>
              )}
              {ex.stopIf.length > 0 && <div className="stop-rule">⛔ Stop if: {ex.stopIf.join("; ")}</div>}
              <div className="source-links">
                {ex.researchLinks.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    {SOURCE_LIST.find((s) => s.url === url)?.label ?? url} ↗
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <Card title="🔬 Research this app leans on">
        {SOURCE_LIST.map((s) => (
          <p key={s.id} className="secondary" style={{ fontSize: "0.84rem" }}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label} ↗
            </a>
            <br />
            {s.keyPoint}
          </p>
        ))}
        <p className="muted">
          External links open the original guidance — nothing here is copied media, and none of it
          is a diagnosis. This app is a self-management aid in the spirit of NICE/NHS/ACP guidance.
        </p>
      </Card>
    </>
  );
}
