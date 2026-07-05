import { type ReactNode, useEffect } from "react";

export function Card(props: { title?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <section className="card" data-testid={props.testId}>
      {props.title && <h2>{props.title}</h2>}
      {props.children}
    </section>
  );
}

export function Slider(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  testId?: string;
}) {
  const { min = 0, max = 10, step = 1 } = props;
  return (
    <div className="slider-field">
      <label>
        <span>{props.label}</span>
        <span className="value">
          {props.value}
          {props.unit ?? ""}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={props.value}
        data-testid={props.testId}
        aria-label={props.label}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Toggle(props: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <label className="toggle-field">
      <span>{props.label}</span>
      <input
        type="checkbox"
        className="switch"
        checked={props.checked}
        data-testid={props.testId}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  );
}

export function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="modal" role="dialog" aria-label={props.title}>
        <h2>
          {props.title}{" "}
          <button className="chip-btn" style={{ float: "right" }} onClick={props.onClose}>
            Close
          </button>
        </h2>
        {props.children}
      </div>
    </div>
  );
}
