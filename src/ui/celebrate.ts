// Pure transition logic for the exercise-completion celebration.
// Kept out of ExerciseCard so it can be unit-tested without a DOM.

/** True only on a genuine unchecked -> checked transition (not on mount, not on re-render while already done). */
export function enteredDone(prevDone: boolean, nextDone: boolean): boolean {
  return !prevDone && nextDone;
}

/** True only on a checked -> unchecked transition. Used to cancel an in-flight celebration cleanly. */
export function leftDone(prevDone: boolean, nextDone: boolean): boolean {
  return prevDone && !nextDone;
}
