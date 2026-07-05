export type Element =
  | "relief"
  | "walking"
  | "mobility"
  | "activation"
  | "stability"
  | "functional-load"
  | "desk-reset";

export type Subtype = "stretch" | "strength" | "isometric" | "aerobic" | "breathing";

export type Irritability = "low" | "medium" | "higher";

export type MediaKind = "local-svg" | "external-link" | "youtube-link" | "gif-link";

export type Exercise = {
  id: string;
  name: string;
  element: Element;
  subtype?: Subtype;
  difficulty: 1 | 2 | 3 | 4 | 5;
  irritability: Irritability;
  defaultDose: string;
  minDose: string;
  progressDose: string;
  regressDose: string;
  targets: string[];
  why: string;
  doWhen: string[];
  avoidWhen: string[];
  stopIf: string[];
  substitutions: string[];
  media: { kind: MediaKind; url?: string; alt: string }[];
  researchLinks: string[];
  safeWhenFlared?: boolean;
  avoidIfSpreading?: boolean;
};

export type Decision =
  | "GET_CHECKED"
  | "BACK_OFF"
  | "HOLD"
  | "DO_MINIMUM"
  | "ADVANCE"
  | "GRADUATE"
  | "EXTEND";

export type RedFlags = {
  legWeakness: boolean;
  saddleNumbness: boolean;
  troubleWalking: boolean;
  bladderBowelChange: boolean;
  troubleStartingUrine: boolean;
  feverChills: boolean;
  vomiting: boolean;
  bloodUrineStool: boolean;
  worseningAbdominalPain: boolean;
};

export const EMPTY_RED_FLAGS: RedFlags = {
  legWeakness: false,
  saddleNumbness: false,
  troubleWalking: false,
  bladderBowelChange: false,
  troubleStartingUrine: false,
  feverChills: false,
  vomiting: false,
  bloodUrineStool: false,
  worseningAbdominalPain: false,
};

export type MorningCheckin = {
  pain: number; // 0-10 on waking
  stiffness: number; // 0-10
  worseThanYesterday: boolean;
  sleepQuality: number; // 0-10
};

export type CurrentCheckin = {
  pain: number; // 0-10 right now
  abdomenPressure: number; // 0-10
};

export type EveningReview = {
  worstSpike: number; // 0-10
  postExercisePainIncrease: number; // 0-10
  painStillElevatedAfterOneHour: boolean;
  symptomsSpread: boolean;
  sittingToleranceMinutes: number;
  standingToleranceMinutes: number;
  walkingToleranceMinutes: number;
  walkingMinutesCompleted: number;
  heatUsed: boolean;
  notes: string;
};

export type DayEntry = {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1-based day of the plan
  morning?: MorningCheckin;
  current?: CurrentCheckin;
  evening?: EveningReview;
  redFlags: RedFlags;
  completedTaskIds: string[];
  /** taskId -> substituted exerciseId */
  swaps: Record<string, string>;
  workBlocksCompleted: number;
  noTwistPledgeKept?: boolean;
  decision?: Decision;
};

export type TimerMode = "idle" | "work" | "break";

export type TimerState = {
  mode: TimerMode;
  /** Absolute epoch ms when the current period ends; null when idle. */
  endsAt: number | null;
  blocksCompletedTotal: number;
};

export type ExtensionKind =
  | "repeat-stabilize"
  | "slow-progression"
  | "walking-focus"
  | "desk-resilience"
  | "stability-focus";

export type ExtensionState = {
  kind: ExtensionKind;
  startedOnDay: number; // plan day the extension started (e.g. 11)
};

export type Settings = {
  vibration: boolean;
  sound: boolean;
};

export type AppState = {
  version: 1;
  startDate: string; // YYYY-MM-DD
  phaseOverride: number | null; // 1-4, or null = automatic
  days: Record<string, DayEntry>;
  badges: Record<string, string>; // badgeId -> ISO date earned
  extension: ExtensionState | null;
  graduatedOn: string | null;
  timer: TimerState;
  settings: Settings;
  lastSavedAt: number | null;
};

export type TaskGroup = "relief" | "movement" | "strength" | "desk";

export type PlanTask = {
  taskId: string;
  exerciseId: string;
  group: TaskGroup;
  /** Included even in DO_MINIMUM days. */
  core: boolean;
};

export type Phase = {
  number: 1 | 2 | 3 | 4;
  name: string;
  days: number[]; // plan days covered
  focus: string;
  tasks: PlanTask[];
};

export type DoseLevel = "regress" | "min" | "default" | "progress";

export type AdjustedTask = PlanTask & {
  exerciseId: string; // after swap
  dose: string;
  doseLevel: DoseLevel;
};

export type AdjustedPlan = {
  phase: Phase;
  decision: Decision;
  tasks: AdjustedTask[];
  droppedTaskIds: string[];
  note: string;
};
