import { useState } from "react";
import type { AdjustedTask, Decision } from "../types";
import { getExercise } from "../data/exercises";
import { swapCandidates } from "../engine/adjust";
import { SOURCE_LIST } from "../data/sources";
import { ExerciseFigure } from "./ExerciseFigure";
import { Modal } from "./bits";

function sourceLabel(url: string): string {
  const s = SOURCE_LIST.find((s) => s.url === url);
  if (s) return s.label.split("—")[0].trim();
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "Source";
  }
}

export function ExerciseCard(props: {
  task: AdjustedTask;
  done: boolean;
  onToggle: () => void;
  onSwap: (newExerciseId: string) => void;
  decision: Decision;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const ex = getExercise(props.task.exerciseId);
  const media = ex.media[0];

  return (
    <div className={`task-card ${props.done ? "done" : ""}`} data-testid={`task-${props.task.taskId}`}>
      <div className="task-head">
        <button
          className={`task-check ${props.done ? "checked" : ""}`}
          onClick={props.onToggle}
          aria-label={`Mark ${ex.name} ${props.done ? "not done" : "done"}`}
          data-testid={`check-${props.task.taskId}`}
        >
          ✓
        </button>
        <div style={{ minWidth: 0, flex: 1 }} onClick={() => setShowDetail(!showDetail)}>
          <div className="task-title">{ex.name}</div>
          <div className={`task-dose ${props.task.doseLevel !== "default" ? "adjusted" : ""}`}>
            {props.task.dose}
            {props.task.doseLevel === "min" && " · easy dose"}
            {props.task.doseLevel === "regress" && " · regressed"}
            {props.task.doseLevel === "progress" && " · progressed"}
          </div>
        </div>
        <div className="task-actions">
          <button className="chip-btn" onClick={() => setShowWhy(!showWhy)} aria-label={`Why ${ex.name}`}>
            Why?
          </button>
          <button
            className="chip-btn"
            onClick={() => setShowSwap(true)}
            data-testid={`swap-${props.task.taskId}`}
          >
            Swap
          </button>
        </div>
      </div>

      {showWhy && <div className="why-box">{ex.why}</div>}

      {showDetail && (
        <>
          <div className="task-detail">
            <ExerciseFigure exerciseId={ex.id} alt={media.alt} />
            <div style={{ fontSize: "0.82rem", minWidth: 0 }}>
              {ex.doWhen.length > 0 && (
                <div className="secondary">Do when: {ex.doWhen.join("; ")}</div>
              )}
              {ex.avoidWhen.length > 0 && (
                <div className="muted">Avoid when: {ex.avoidWhen.join("; ")}</div>
              )}
              <div className="source-links">
                {ex.researchLinks.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    {sourceLabel(url)} ↗
                  </a>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {ex.stopIf.length > 0 && <div className="stop-rule">⛔ Stop if: {ex.stopIf.join("; ")}</div>}

      {showSwap && (
        <SwapModal
          currentExerciseId={ex.id}
          decision={props.decision}
          onPick={(id) => {
            props.onSwap(id);
            setShowSwap(false);
          }}
          onClose={() => setShowSwap(false)}
        />
      )}
    </div>
  );
}

export function SwapModal(props: {
  currentExerciseId: string;
  decision: Decision;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const current = getExercise(props.currentExerciseId);
  const candidates = swapCandidates(props.currentExerciseId, props.decision);
  const restrictive = ["HOLD", "BACK_OFF", "GET_CHECKED", "DO_MINIMUM"].includes(props.decision);

  return (
    <Modal title={`Swap: ${current.name}`} onClose={props.onClose}>
      <p className="secondary">
        Alternatives that train the same element (<strong>{current.element}</strong>)
        {restrictive
          ? " at equal or lower irritability, since today is not a green day."
          : " at similar or slightly higher difficulty."}
      </p>
      {candidates.length === 0 && <p className="muted">No suitable alternatives found — rest is a valid substitute today.</p>}
      {candidates.map((ex) => (
        <div className="task-card" key={ex.id} data-testid={`swap-option-${ex.id}`}>
          <div className="task-head">
            <ExerciseFigure exerciseId={ex.id} alt={ex.media[0].alt} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="task-title">{ex.name}</div>
              <div className="task-dose">{ex.defaultDose}</div>
              <div className="muted" style={{ marginTop: 2 }}>
                {ex.why}
              </div>
            </div>
          </div>
          <button className="primary-btn" style={{ marginTop: 8 }} onClick={() => props.onPick(ex.id)}>
            Use this instead
          </button>
        </div>
      ))}
    </Modal>
  );
}
