import type { DayEntry, EveningReview } from "../types";
import { Slider, Toggle } from "./bits";

type Props = {
  day: DayEntry;
  onEdit: (fn: (d: DayEntry) => DayEntry) => void;
};

const defaultEveningFor = (day: DayEntry): EveningReview => ({
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
});

/**
 * Edits one past day's check-ins. Red flags and task completion are
 * intentionally NOT editable here: red flags are safety data that should
 * never be rewritten after the fact, and task completion is out of scope
 * for this editor.
 */
export function DayEditor({ day, onEdit }: Props) {
  return (
    <>
      <h3>Morning check-in</h3>
      <Slider
        label="Pain on waking"
        value={day.morning?.pain ?? 3}
        testId="editor-morning-pain"
        onChange={(v) =>
          onEdit((d) => ({
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
            testId="editor-stiffness"
            onChange={(v) => onEdit((d) => ({ ...d, morning: { ...d.morning!, stiffness: v } }))}
          />
          <Slider
            label="Sleep quality"
            value={day.morning.sleepQuality}
            testId="editor-sleep-quality"
            onChange={(v) => onEdit((d) => ({ ...d, morning: { ...d.morning!, sleepQuality: v } }))}
          />
          <Toggle
            label="Worse than yesterday morning?"
            checked={day.morning.worseThanYesterday}
            testId="editor-worse-than-yesterday"
            onChange={(v) => onEdit((d) => ({ ...d, morning: { ...d.morning!, worseThanYesterday: v } }))}
          />
        </>
      )}

      <h3>Right now</h3>
      <Slider
        label="Pain right now"
        value={day.current?.pain ?? day.morning?.pain ?? 3}
        testId="editor-current-pain"
        onChange={(v) =>
          onEdit((d) => ({
            ...d,
            current: { pain: v, abdomenPressure: d.current?.abdomenPressure ?? 0 },
          }))
        }
      />
      <Slider
        label="Deep abdominal pressure"
        value={day.current?.abdomenPressure ?? 0}
        testId="editor-abdomen-pressure"
        onChange={(v) =>
          onEdit((d) => ({
            ...d,
            current: { pain: d.current?.pain ?? d.morning?.pain ?? 3, abdomenPressure: v },
          }))
        }
      />

      <h3>Evening review</h3>
      {!day.evening && (
        <button
          className="primary-btn"
          data-testid="editor-add-evening"
          onClick={() => onEdit((d) => ({ ...d, evening: defaultEveningFor(d) }))}
        >
          Add evening review
        </button>
      )}
      {day.evening && (
        <EveningEditorForm
          evening={day.evening}
          onChange={(patch) => onEdit((d) => ({ ...d, evening: { ...d.evening!, ...patch } }))}
        />
      )}

      <h3>Desk work</h3>
      <Slider
        label="Desk work blocks completed"
        value={day.workBlocksCompleted}
        min={0}
        max={12}
        testId="editor-work-blocks"
        onChange={(v) => onEdit((d) => ({ ...d, workBlocksCompleted: v }))}
      />

      <p className="muted">
        Red flags and task completion aren't editable here — red flags are safety data that
        shouldn't be rewritten after the fact, and task completion is out of scope.
      </p>
    </>
  );
}

function EveningEditorForm(props: { evening: EveningReview; onChange: (p: Partial<EveningReview>) => void }) {
  const e = props.evening;
  return (
    <>
      <Slider
        label="Worst pain spike today"
        value={e.worstSpike}
        testId="editor-worst-spike"
        onChange={(v) => props.onChange({ worstSpike: v })}
      />
      <Slider
        label="Pain increase right after exercise"
        value={e.postExercisePainIncrease}
        testId="editor-post-exercise-increase"
        onChange={(v) => props.onChange({ postExercisePainIncrease: v })}
      />
      <Toggle
        label="Still elevated 1 hour after exercise?"
        checked={e.painStillElevatedAfterOneHour}
        testId="editor-elevated-after-hour"
        onChange={(v) => props.onChange({ painStillElevatedAfterOneHour: v })}
      />
      <Toggle
        label="Symptoms spread outward or down a leg?"
        checked={e.symptomsSpread}
        testId="editor-symptoms-spread"
        onChange={(v) => props.onChange({ symptomsSpread: v })}
      />
      <Toggle
        label="Used heat today?"
        checked={e.heatUsed}
        testId="editor-heat-used"
        onChange={(v) => props.onChange({ heatUsed: v })}
      />
      <Slider
        label="Sitting tolerance (min)"
        value={e.sittingToleranceMinutes}
        min={0}
        max={180}
        step={5}
        unit="m"
        testId="editor-sitting-tolerance"
        onChange={(v) => props.onChange({ sittingToleranceMinutes: v })}
      />
      <Slider
        label="Standing tolerance (min)"
        value={e.standingToleranceMinutes}
        min={0}
        max={120}
        step={5}
        unit="m"
        testId="editor-standing-tolerance"
        onChange={(v) => props.onChange({ standingToleranceMinutes: v })}
      />
      <Slider
        label="Walking tolerance (min)"
        value={e.walkingToleranceMinutes}
        min={0}
        max={60}
        step={5}
        unit="m"
        testId="editor-walking-tolerance"
        onChange={(v) => props.onChange({ walkingToleranceMinutes: v })}
      />
      <Slider
        label="Walking minutes actually done"
        value={e.walkingMinutesCompleted}
        min={0}
        max={90}
        step={5}
        unit="m"
        testId="editor-walking-done"
        onChange={(v) => props.onChange({ walkingMinutesCompleted: v })}
      />
      <div style={{ marginTop: 8 }}>
        <label className="secondary" htmlFor="editor-notes">
          Notes (triggers, what helped, anything odd)
        </label>
        <textarea
          id="editor-notes"
          rows={3}
          value={e.notes}
          data-testid="editor-notes"
          onChange={(ev) => props.onChange({ notes: ev.target.value })}
        />
      </div>
    </>
  );
}
