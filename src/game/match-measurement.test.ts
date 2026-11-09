import { describe, expect, it } from "vitest";
import type { FpsSample } from "./fps-meter";
import {
  matchMeasurementKey,
  matchMeasurementPhase,
  nextAutomaticMatchQuality,
} from "./match-measurement";

const playing = {
  introActive: false,
  ceremonyActive: false,
  paused: false,
  halfHeld: false,
  done: false,
  postMatchStep: null,
  matchPhase: "first",
};

const healthy: FpsSample = {
  now: 60,
  avg: 60,
  worst: 60,
  low1: 60,
  seconds: 6,
  windowMs: 6000,
  source: "rendered",
  quality: "media",
  phase: "match",
};

describe("match measurement scope", () => {
  it.each([
    [{ introActive: true }, "intro"],
    [{ ceremonyActive: true }, "ceremony"],
    [{ paused: true }, "paused"],
    [{ halfHeld: true }, "interval"],
    [{ matchPhase: "half" }, "interval"],
    [{ matchPhase: "etBreak" }, "interval"],
    [{ done: true }, "finished"],
    [{ matchPhase: "done" }, "finished"],
    [{ postMatchStep: 0 }, "finished"],
  ] as const)("excludes %j from stadium sampling and promotion", (patch, expected) => {
    const phase = matchMeasurementPhase({ ...playing, ...patch });
    expect(phase).toBe(expected);
    expect(nextAutomaticMatchQuality({ ...healthy, phase }, "media", phase === "match")).toBe(
      "media",
    );
  });

  it.each(["first", "second", "et1", "et2", "shootout"])(
    "classifies an active %s stadium only from rendered samples",
    (matchPhase) => {
      expect(matchMeasurementPhase({ ...playing, matchPhase })).toBe("match");
      expect(nextAutomaticMatchQuality(healthy, "media", true)).toBe("alta");
      expect(nextAutomaticMatchQuality({ ...healthy, source: "raf" }, "media", true)).toBe("media");
    },
  );

  it("rejects insufficient, stale, hidden and invalid samples", () => {
    expect(nextAutomaticMatchQuality(healthy, "media", false)).toBe("media");
    expect(nextAutomaticMatchQuality({ ...healthy, quality: "baixa" }, "media", true)).toBe(
      "media",
    );
    expect(nextAutomaticMatchQuality({ ...healthy, windowMs: 5900 }, "media", true)).toBe("media");
    expect(nextAutomaticMatchQuality({ ...healthy, avg: Number.NaN }, "media", true)).toBe("media");
    const { windowMs: _windowMs, ...withoutWindow } = healthy;
    expect(nextAutomaticMatchQuality(withoutWindow, "media", true)).toBe("media");
    expect(nextAutomaticMatchQuality({ ...healthy, avg: 0, low1: 0 }, "media", true)).toBe("media");
  });

  it("changes only one preset from evidence for the current stadium", () => {
    expect(
      nextAutomaticMatchQuality({ ...healthy, avg: 25, low1: 18, quality: "alta" }, "alta", true),
    ).toBe("media");
    expect(nextAutomaticMatchQuality({ ...healthy, avg: 25, low1: 18 }, "media", true)).toBe(
      "baixa",
    );
    expect(nextAutomaticMatchQuality({ ...healthy, quality: "baixa" }, "baixa", true)).toBe(
      "media",
    );
  });

  it("separates preset, camera, seed, fixture, speed and phase campaigns", () => {
    const context = {
      seed: "match-123",
      home: "home",
      away: "away",
      quality: "alta",
      camera: "tactical",
      speed: 1,
      phase: "match" as const,
    };
    const key = matchMeasurementKey(context);
    for (const patch of [
      { quality: "media" },
      { camera: "broadcast" },
      { seed: "match-456" },
      { home: "another-home" },
      { away: "another-away" },
      { speed: 4 },
      { phase: "paused" as const },
    ])
      expect(matchMeasurementKey({ ...context, ...patch })).not.toBe(key);
  });
});
