// WebAudio timer chime — no assets, tones synthesized on the fly.
//
// iOS Safari suspends (or refuses to start) an AudioContext unless it's
// created/resumed from inside a user-gesture handler (a click, not a timer
// callback). So we lazily create one module-level context via unlockAudio(),
// called from the timer's start/stop buttons, and reuse it later from the
// (non-gesture) transition effect where the actual chime plays.

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getCtor(): AudioCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Create (or resume) the shared AudioContext. Call from a user-gesture handler. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor = getCtor();
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* WebAudio unavailable — chimes silently no-op */
  }
}

function tone(startAt: number, freq: number, durationS: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  // Short attack/decay envelope so tones don't click at the edges.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.2, startAt + 0.02);
  gain.gain.linearRampToValueAtTime(0, startAt + durationS);
  osc.start(startAt);
  osc.stop(startAt + durationS);
}

/** Play a short chime for a desk-timer transition. Never throws. */
export function playChime(kind: "work-end" | "break-end"): void {
  try {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (kind === "work-end") {
      // Two rising notes: work block done, break starting.
      tone(now, 880, 0.12);
      tone(now + 0.13, 1175, 0.12);
    } else {
      // One soft note: break's over, back to work.
      tone(now, 660, 0.15);
    }
  } catch {
    /* WebAudio unavailable — chimes silently no-op */
  }
}
