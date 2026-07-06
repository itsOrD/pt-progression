/**
 * Clamp a value to the clinical 0-10 integer score range used by every check-in
 * field (pain, stiffness, sleep quality, worst spike, abdominal pressure, etc.).
 *
 * UI sliders already only ever emit integers 0-10, so this changes nothing for
 * slider-driven input. It exists as a belt-and-braces guard for data that can
 * bypass the slider's own range/step — imported JSON, hand-edited local storage,
 * or a future control that allows fractional input — so a stray 7.4 or -3 can
 * never reach the decision engine and silently fall through its band checks.
 */
export function clampScore(n: number): number {
  // NaN carries no clinical signal (e.g. a corrupted import). Treat it as the
  // most conservative reading — 0 — rather than propagating NaN into the engine,
  // where NaN comparisons (`NaN >= 6`) are always false and would silently skip
  // every band check.
  if (Number.isNaN(n)) return 0;
  return Math.min(10, Math.max(0, Math.round(n)));
}
