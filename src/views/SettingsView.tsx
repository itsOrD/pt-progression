import { useRef, useState } from "react";
import type { AppState } from "../types";
import { Card, Modal, Toggle } from "../ui/bits";
import { DECISION_META } from "../ui/charts";
import { exportJson, importJson, encodeStateToHash } from "../state/storage";
import { buildClinicianReportData, scoreFor, sortedDayEntries } from "../state/selectors";
import { activeRedFlags } from "../engine/decision";
import { PHASES } from "../data/plan";

export function SettingsView(props: {
  state: AppState;
  todayKey: string;
  setState: (fn: (s: AppState) => AppState) => void;
  onReset: () => void;
  onSummaryGenerated: () => void;
  showToast: (msg: string) => void;
}) {
  const { state, setState, showToast } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const doExport = () => {
    const blob = new Blob([exportJson(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `back-pt-data-${props.todayKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported JSON");
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const imported = importJson(text);
    if (!imported) {
      showToast("That file didn't look like a valid backup.");
      return;
    }
    setState(() => imported);
    showToast("Data imported ✔");
  };

  const copyBackupLink = async () => {
    const url = new URL(window.location.href);
    url.hash = encodeStateToHash(state);
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast("Backup link copied — save it anywhere");
    } catch {
      prompt("Copy this backup link:", url.toString());
    }
  };

  const makeSummary = () => {
    const text = buildClinicianSummary(state, props.todayKey);
    setSummary(text);
    props.onSummaryGenerated();
  };

  const shareSummary = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Back pain summary", text });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Summary copied to clipboard");
    } catch {
      /* the textarea below is selectable */
    }
  };

  return (
    <>
      <Card title="⚙️ Plan settings">
        <div className="slider-field">
          <label htmlFor="start-date">Plan start date</label>
          <input
            id="start-date"
            type="date"
            value={state.startDate}
            data-testid="start-date"
            onChange={(e) => {
              if (e.target.value) setState((s) => ({ ...s, startDate: e.target.value }));
            }}
          />
        </div>
        <div className="slider-field">
          <label>Phase override</label>
          <div className="row">
            <button
              className={`filter-chip ${state.phaseOverride === null ? "on" : ""}`}
              onClick={() => setState((s) => ({ ...s, phaseOverride: null }))}
            >
              Automatic
            </button>
            {PHASES.map((p) => (
              <button
                key={p.number}
                className={`filter-chip ${state.phaseOverride === p.number ? "on" : ""}`}
                data-testid={`phase-override-${p.number}`}
                onClick={() => setState((s) => ({ ...s, phaseOverride: p.number }))}
              >
                {p.number}. {p.name}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          label="Vibration on timer transitions"
          checked={state.settings.vibration}
          onChange={(v) => setState((s) => ({ ...s, settings: { ...s.settings, vibration: v } }))}
        />
      </Card>

      <Card title="💾 Your data" testId="data-card">
        <p className="muted" style={{ marginTop: 0 }}>
          Everything lives on this device (localStorage) — no account, no tracking.{" "}
          {state.lastSavedAt
            ? `Last saved ${new Date(state.lastSavedAt).toLocaleString()}.`
            : "Not saved yet."}
        </p>
        <button className="primary-btn" onClick={doExport} data-testid="export-json">
          Export JSON
        </button>
        <div style={{ height: 8 }} />
        <button className="ghost-btn" onClick={() => fileRef.current?.click()} data-testid="import-json">
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          data-testid="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
        <div style={{ height: 8 }} />
        <button className="ghost-btn" onClick={copyBackupLink} data-testid="copy-backup-link">
          Copy URL backup link
        </button>
        <p className="muted">
          The app also mirrors your data into the page URL after each change, so bookmarking the
          page doubles as a backup.
        </p>
        <button
          className="danger-btn"
          data-testid="reset-data"
          onClick={() => {
            if (confirm("Erase all local data? Export first if you want to keep it.")) {
              props.onReset();
            }
          }}
        >
          Reset all data
        </button>
      </Card>

      <Card title="🩺 Clinician summary">
        <p className="muted" style={{ marginTop: 0 }}>
          A plain-text rundown of your numbers to bring to a PT or doctor, or a formatted report
          you can print for the appointment.
        </p>
        <button className="primary-btn" onClick={makeSummary} data-testid="make-summary">
          Generate summary
        </button>
        <div style={{ height: 8 }} />
        <button
          className="ghost-btn"
          onClick={() => setShowReport(true)}
          data-testid="print-report-btn"
        >
          Print report
        </button>
        {summary && (
          <>
            <textarea
              readOnly
              rows={12}
              value={summary}
              style={{ marginTop: 10, fontSize: "0.78rem", fontFamily: "ui-monospace, monospace" }}
              data-testid="summary-text"
            />
            <div style={{ height: 8 }} />
            <button className="ghost-btn" onClick={() => shareSummary(summary)}>
              Share / copy
            </button>
          </>
        )}
      </Card>

      {showReport && (
        <ClinicianReportModal
          state={state}
          todayKey={props.todayKey}
          onClose={() => setShowReport(false)}
        />
      )}

      <Card title="ℹ️ About">
        <p className="muted" style={{ margin: 0 }}>
          Personal self-management tracker for a mechanical low-back flare, built around NICE
          NG59, NHS, ACP, AAOS, and APTA guidance. It never diagnoses, and red flags always
          override streaks, badges, and progression. If in doubt, see a human.
        </p>
      </Card>
    </>
  );
}

function buildClinicianSummary(state: AppState, todayKey: string): string {
  const entries = sortedDayEntries(state);
  const score = scoreFor(state, todayKey);
  const lines: string[] = [];
  lines.push(`LOW BACK PAIN SELF-TRACKING SUMMARY (generated ${todayKey})`);
  lines.push(`Plan started: ${state.startDate} — ${entries.length} day(s) logged`);
  lines.push("");
  lines.push("Context: ~48yo software developer, acute low-back flare. Pain center spine,");
  lines.push("both SI areas, outer upper hips. Heat helps. Long computer days (~12h).");
  lines.push("Noted deep abdominal/restroom-pressure sensation — tracked daily below.");
  lines.push("");
  lines.push("Day | AM pain | Now | Spike | AbdPressure | Sit(min) | Walk done | Decision");
  for (const d of entries) {
    lines.push(
      [
        `D${d.dayNumber}`,
        d.morning?.pain ?? "—",
        d.current?.pain ?? "—",
        d.evening?.worstSpike ?? "—",
        d.current?.abdomenPressure ?? "—",
        d.evening?.sittingToleranceMinutes ?? "—",
        d.evening?.walkingMinutesCompleted ?? "—",
        d.decision ?? "—",
      ].join(" | ")
    );
  }
  lines.push("");
  const flagged = entries.filter((d) => activeRedFlags(d.redFlags).length > 0);
  lines.push(
    flagged.length
      ? `Red flags reported: ${flagged.map((d) => `D${d.dayNumber}: ${activeRedFlags(d.redFlags).join(", ")}`).join("; ")}`
      : "Red flags reported: none"
  );
  lines.push(`Self-tracked recovery score: ${score.score}/100 (${score.label})`);
  lines.push("");
  const notes = entries.filter((d) => d.evening?.notes.trim());
  if (notes.length) {
    lines.push("Notes:");
    for (const d of notes) lines.push(`  D${d.dayNumber}: ${d.evening!.notes.trim()}`);
  }
  lines.push("");
  lines.push("Generated by a personal self-management tracker (not a diagnostic tool).");
  return lines.join("\n");
}

function graduationStatusText(data: ReturnType<typeof buildClinicianReportData>): string {
  if (data.graduatedOn) return `Graduated to maintenance on ${data.graduatedOn}.`;
  switch (data.planStatus.kind) {
    case "graduate":
      return `Graduation criteria met: ${data.planStatus.result.metCriteria.join("; ")}.`;
    case "extend":
      return `Not yet at graduation criteria — extension suggested (${data.planStatus.extensionKind.replace(/-/g, " ")}). ${data.planStatus.reasons.join(" ")}`;
    case "formal-help":
      return `Formal PT/clinician evaluation recommended. ${data.planStatus.reasons.join(" ")}`;
    case "continue":
    default:
      return "Still within the initial 10-day plan; graduation not yet evaluated (day 10+ triggers that check).";
  }
}

function ClinicianReportModal(props: { state: AppState; todayKey: string; onClose: () => void }) {
  const data = buildClinicianReportData(props.state, props.todayKey);

  return (
    <Modal title="Printable report" onClose={props.onClose}>
      <div id="clinician-report" className="clinician-report" data-testid="clinician-report">
        <h1>Back PT self-management report</h1>
        <p className="report-meta">
          {data.startDate} to {data.generatedOn} · {data.dayCount} day{data.dayCount === 1 ? "" : "s"} logged
        </p>

        <h3>Day-by-day decisions</h3>
        <table className="report-table" data-testid="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>AM pain</th>
              <th>Worst spike</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.date} data-testid="report-row">
                <td>{r.date}</td>
                <td>{r.dayNumber}</td>
                <td>{r.morningPain ?? "—"}</td>
                <td>{r.worstSpike ?? "—"}</td>
                <td>{r.decision ? DECISION_META[r.decision].label : "—"}</td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={5}>No days logged yet.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h3>Trends (first vs. latest)</h3>
        <ul>
          {data.trends.map((t) => (
            <li key={t.label}>
              {t.label}: {t.first === null ? "—" : `${t.first}${t.unit}`} →{" "}
              {t.latest === null ? "—" : `${t.latest}${t.unit}`}
            </li>
          ))}
        </ul>

        <h3>Red flags</h3>
        <div data-testid="report-red-flags">
          {data.redFlagDays.length === 0 ? (
            <p>None reported.</p>
          ) : (
            <ul>
              {data.redFlagDays.map((d) => (
                <li key={d.date}>
                  Day {d.dayNumber} ({d.date}): {d.flags.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>

        <h3>Phase and graduation status</h3>
        <p>
          Currently Phase {data.phaseNumber} ({data.phaseName}). {graduationStatusText(data)}
        </p>

        <p className="report-footer">
          Generated by a personal self-management tracker (not a diagnostic tool).
        </p>
      </div>

      <div style={{ height: 8 }} />
      <button className="primary-btn" onClick={() => window.print()} data-testid="print-report-action">
        Print
      </button>
    </Modal>
  );
}
