import type { Phase } from "../types";

export const PLAN_LENGTH_DAYS = 10;
export const EXTENSION_LENGTH_DAYS = 7;

export const PHASES: Phase[] = [
  {
    number: 1,
    name: "Calm",
    days: [1, 2, 3],
    focus: "Settle the flare: relief, gentle motion, short walks, frequent desk breaks.",
    tasks: [
      { taskId: "p1-heat", exerciseId: "heat-reset", group: "relief", core: true },
      { taskId: "p1-breathing", exerciseId: "breathing", group: "relief", core: true },
      { taskId: "p1-9090", exerciseId: "ninety-ninety-rest", group: "relief", core: false },
      { taskId: "p1-walk", exerciseId: "short-walk", group: "movement", core: true },
      { taskId: "p1-tilts", exerciseId: "pelvic-tilts", group: "movement", core: true },
      { taskId: "p1-catcow", exerciseId: "cat-cow", group: "movement", core: false },
      { taskId: "p1-brace", exerciseId: "abdominal-brace", group: "strength", core: false },
      { taskId: "p1-glute", exerciseId: "glute-squeeze", group: "strength", core: false },
      { taskId: "p1-timer", exerciseId: "walk-room", group: "desk", core: true },
      { taskId: "p1-recenter", exerciseId: "monitor-recenter", group: "desk", core: true },
      { taskId: "p1-swivel", exerciseId: "chair-swivel", group: "desk", core: false },
    ],
  },
  {
    number: 2,
    name: "Stabilize",
    days: [4, 5, 6],
    focus: "Keep relief tools, grow the walk, add activation and entry-level stability.",
    tasks: [
      { taskId: "p2-heat", exerciseId: "heat-reset", group: "relief", core: true },
      { taskId: "p2-walk", exerciseId: "walk-progression", group: "movement", core: true },
      { taskId: "p2-tilts", exerciseId: "pelvic-tilts", group: "movement", core: true },
      { taskId: "p2-catcow", exerciseId: "cat-cow", group: "movement", core: false },
      { taskId: "p2-direction", exerciseId: "direction-check", group: "movement", core: false },
      { taskId: "p2-brace", exerciseId: "abdominal-brace", group: "strength", core: true },
      { taskId: "p2-heel", exerciseId: "heel-slides", group: "strength", core: false },
      { taskId: "p2-clam", exerciseId: "clamshell", group: "strength", core: false },
      { taskId: "p2-bda", exerciseId: "bird-dog-arms", group: "strength", core: false },
      { taskId: "p2-timer", exerciseId: "walk-room", group: "desk", core: true },
      { taskId: "p2-spt", exerciseId: "standing-pelvic-tilts", group: "desk", core: true },
      { taskId: "p2-dgs", exerciseId: "desk-glute-squeeze", group: "desk", core: false },
    ],
  },
  {
    number: 3,
    name: "Control",
    days: [7, 8],
    focus: "Fuller stability work, longer walks, keep the desk system running.",
    tasks: [
      { taskId: "p3-heat", exerciseId: "heat-reset", group: "relief", core: false },
      { taskId: "p3-walk", exerciseId: "walk-progression", group: "movement", core: true },
      { taskId: "p3-hf", exerciseId: "hip-flexor-opener", group: "movement", core: false },
      { taskId: "p3-bridge", exerciseId: "bridge", group: "strength", core: true },
      { taskId: "p3-bdl", exerciseId: "bird-dog-legs", group: "strength", core: true },
      { taskId: "p3-dba", exerciseId: "dead-bug-arms", group: "strength", core: false },
      { taskId: "p3-marching", exerciseId: "marching-brace", group: "strength", core: false },
      { taskId: "p3-sts", exerciseId: "sit-to-stand", group: "strength", core: true },
      { taskId: "p3-timer", exerciseId: "walk-room", group: "desk", core: true },
      { taskId: "p3-sbd", exerciseId: "standing-bird-dog", group: "desk", core: false },
      { taskId: "p3-spt", exerciseId: "standing-pelvic-tilts", group: "desk", core: false },
    ],
  },
  {
    number: 4,
    name: "Return",
    days: [9, 10],
    focus: "Functional load: hinge, carries, full bird dog — building toward maintenance.",
    tasks: [
      { taskId: "p4-walk", exerciseId: "walk-progression", group: "movement", core: true },
      { taskId: "p4-hf", exerciseId: "hip-flexor-opener", group: "movement", core: false },
      { taskId: "p4-bridge", exerciseId: "bridge-shift", group: "strength", core: true },
      { taskId: "p4-bdf", exerciseId: "bird-dog-full", group: "strength", core: true },
      { taskId: "p4-dbh", exerciseId: "dead-bug-heel-taps", group: "strength", core: false },
      { taskId: "p4-sp", exerciseId: "side-plank-mod", group: "strength", core: false },
      { taskId: "p4-hinge", exerciseId: "hip-hinge", group: "strength", core: true },
      { taskId: "p4-carry", exerciseId: "suitcase-carry", group: "strength", core: false },
      { taskId: "p4-timer", exerciseId: "walk-room", group: "desk", core: true },
      { taskId: "p4-sbd", exerciseId: "standing-bird-dog", group: "desk", core: false },
    ],
  },
];

/** Maintenance circuit shown after graduation. */
export const MAINTENANCE_TASKS = [
  "walk-progression",
  "bridge",
  "bird-dog-full",
  "side-plank-mod",
  "hip-hinge",
  "farmer-carry",
];

export function phaseForDay(day: number, override: number | null): Phase {
  if (override) {
    const p = PHASES.find((ph) => ph.number === override);
    if (p) return p;
  }
  if (day <= 0) return PHASES[0];
  const found = PHASES.find((p) => p.days.includes(day));
  if (found) return found;
  // Past day 10 (extension or overdue): stay in the last phase by default.
  return PHASES[PHASES.length - 1];
}
