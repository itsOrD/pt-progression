import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// chime.ts holds module-level state (the shared AudioContext), so every test
// resets the module registry and re-imports fresh, and installs its own fake
// AudioContext on globalThis.window before that import — mirroring how a real
// browser exposes `window.AudioContext`.

class FakeGainParam {
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}

class FakeGainNode {
  gain = new FakeGainParam();
  connect = vi.fn();
}

class FakeOscillatorNode {
  frequency = { value: 0 };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  state: "suspended" | "running" = "suspended";
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => {
    this.state = "running";
    return Promise.resolve();
  });
  createOscillator = vi.fn(() => new FakeOscillatorNode());
  createGain = vi.fn(() => new FakeGainNode());

  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

function installFakeAudioContext(): void {
  FakeAudioContext.instances = [];
  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: FakeAudioContext,
  };
}

function removeAudioContextSupport(): void {
  // `window` exists (as in a real browser) but has no WebAudio constructor at
  // all — the environment simply doesn't support it.
  (globalThis as unknown as { window: unknown }).window = {};
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("playChime before unlockAudio", () => {
  it("never constructs an AudioContext and is a silent no-op", async () => {
    installFakeAudioContext();
    const { playChime } = await import("./chime");

    expect(() => playChime("work-end")).not.toThrow();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
});

describe("unlockAudio", () => {
  it("constructs and resumes exactly one context, reused on subsequent calls", async () => {
    installFakeAudioContext();
    const { unlockAudio } = await import("./chime");

    unlockAudio();
    unlockAudio();
    unlockAudio();

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalledTimes(1);
  });
});

describe("playChime after unlockAudio", () => {
  it("schedules two tones for work-end and one tone for break-end", async () => {
    installFakeAudioContext();
    const { playChime, unlockAudio } = await import("./chime");

    unlockAudio();
    const ctx = FakeAudioContext.instances[0];

    playChime("work-end");
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);

    ctx.createOscillator.mockClear();

    playChime("break-end");
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });
});

describe("no AudioContext available", () => {
  it("unlockAudio and playChime do not throw", async () => {
    removeAudioContextSupport();
    const { playChime, unlockAudio } = await import("./chime");

    expect(() => unlockAudio()).not.toThrow();
    expect(() => playChime("work-end")).not.toThrow();
    expect(() => playChime("break-end")).not.toThrow();
  });
});
