export type Badge = {
  id: string;
  name: string;
  emoji: string;
  description: string;
};

export const BADGES: Badge[] = [
  { id: "first-checkin", name: "First Check-In", emoji: "📝", description: "Completed your first daily check-in." },
  { id: "heat-helped", name: "Heat Helped", emoji: "🔥", description: "Used heat as part of a day's plan." },
  { id: "walked-before-work", name: "Walked Before Work", emoji: "🌅", description: "Logged a walk on a day you also completed work blocks." },
  { id: "desk-timer-streak", name: "Desk Timer Streak", emoji: "⏱️", description: "Completed 4+ work blocks in a single day." },
  { id: "no-twist-workday", name: "No-Twist Workday", emoji: "🪑", description: "Kept the chair-swivel/no-spine-twist pledge for a full workday." },
  { id: "mobility-minimum", name: "Mobility Minimum Done", emoji: "🤸", description: "Completed all movement tasks on a day." },
  { id: "core-primer", name: "Core Primer Done", emoji: "🧱", description: "Completed all strength/stability tasks on a day." },
  { id: "two-green-days", name: "Two Green Days", emoji: "🌿", description: "Two consecutive days with an Advance decision." },
  { id: "three-green-days", name: "Three Green Days", emoji: "🌳", description: "Three consecutive green days — graduation territory." },
  { id: "smart-back-off", name: "Smart Back-Off", emoji: "🧠", description: "Backed off when your body asked for it. That is progress, not failure." },
  { id: "symptom-detective", name: "Symptom Detective", emoji: "🔍", description: "Logged detailed notes across 3 days." },
  { id: "maintenance-ready", name: "Maintenance Ready", emoji: "🎓", description: "Met graduation criteria." },
  { id: "pt-ready-summary", name: "PT-Ready Summary", emoji: "📄", description: "Generated a clinician summary." },
];

export const BADGE_MAP: Record<string, Badge> = Object.fromEntries(BADGES.map((b) => [b.id, b]));
