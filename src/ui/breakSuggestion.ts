export type BreakTask = {
  taskId: string;
  exerciseId: string;
  name: string;
  dose: string;
  done: boolean;
};

/**
 * Rotate through today's desk tasks so repeated breaks don't all suggest the
 * same exercise — starting at startIdx, take the first not-done task
 * (wrapping) so the "Did it" button is always actionable when shown.
 * Returns undefined when there are no tasks, or every task is already done.
 */
export function pickBreakSuggestion(tasks: BreakTask[], startIdx: number): BreakTask | undefined {
  if (tasks.length === 0) return undefined;
  for (let i = 0; i < tasks.length; i++) {
    const candidate = tasks[(startIdx + i) % tasks.length];
    if (!candidate.done) return candidate;
  }
  return undefined;
}
