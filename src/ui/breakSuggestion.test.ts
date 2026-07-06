import { describe, expect, it } from "vitest";
import { pickBreakSuggestion, type BreakTask } from "./breakSuggestion";

function task(taskId: string, done: boolean): BreakTask {
  return { taskId, exerciseId: `ex-${taskId}`, name: `Task ${taskId}`, dose: "1x10", done };
}

describe("pickBreakSuggestion", () => {
  it("returns undefined for an empty task list", () => {
    expect(pickBreakSuggestion([], 0)).toBeUndefined();
  });

  it("returns undefined when every task is already done (all-done signal)", () => {
    const tasks = [task("a", true), task("b", true), task("c", true)];
    expect(pickBreakSuggestion(tasks, 1)).toBeUndefined();
  });

  it("returns the task at startIdx when it isn't done", () => {
    const tasks = [task("a", true), task("b", false), task("c", false)];
    expect(pickBreakSuggestion(tasks, 1)).toEqual(task("b", false));
  });

  it("skips several done tasks and wraps around to find the next not-done one", () => {
    // startIdx lands near the end of the list; everything from there through
    // the wrap back to the front is done except one task in the middle.
    const tasks = [
      task("a", true), // index 0 - done, reached after wrapping
      task("b", true), // index 1 - done, reached after wrapping
      task("c", false), // index 2 - the one we expect
      task("d", true), // index 3 - done
      task("e", true), // index 4 - startIdx, done
    ];
    expect(pickBreakSuggestion(tasks, 4)).toEqual(task("c", false));
  });
});
