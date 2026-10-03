import { describe, expect, it } from "vitest";
import {
  sampleVisemeAt,
  RESTING_VOICE_CLOCK,
  validateVisemeTrack,
  voiceClockFromContext,
  type TimedViseme,
} from "./cutscene-visemes";

const track: TimedViseme[] = [
  { atMs: 0, shape: "silence" },
  { atMs: 100, shape: "AA" },
  { atMs: 220, shape: "U" },
  { atMs: 360, shape: "silence" },
];

describe("cutscene viseme timing", () => {
  it("keeps lips at rest before a track and opens into authored speech", () => {
    expect(sampleVisemeAt(track, -1).open).toBeCloseTo(0.015);
    expect(sampleVisemeAt(track, 140).open).toBeGreaterThan(0.7);
  });

  it("distinguishes broad vowels from rounded vowels", () => {
    const broad = sampleVisemeAt(track, 200);
    const rounded = sampleVisemeAt(track, 300);
    expect(broad.wide).toBeGreaterThan(rounded.wide);
    expect(rounded.round).toBeGreaterThan(broad.round);
  });

  it("returns to rest after the authored silence marker", () => {
    expect(sampleVisemeAt(track, 390)).toEqual({ open: 0.015, wide: 0.1, round: 0 });
  });

  it("validates clip-bounded, ordered cues with silence endpoints", () => {
    expect(validateVisemeTrack(track, 360)).toEqual([]);
    expect(
      validateVisemeTrack(
        [
          { atMs: 4, shape: "AA" },
          { atMs: 3, shape: "silence" },
        ],
        2,
      ),
    ).toEqual(
      expect.arrayContaining([
        "the first cue must start at 0ms",
        "cue 0 is outside the clip duration",
        "cue 1 is outside the clip duration",
        "cue 1 is not strictly ordered",
      ]),
    );
  });

  it("samples an audio-context clock from its clip offset", () => {
    const context = { currentTime: 8.1 };
    const clock = voiceClockFromContext(context, 8, 40, track);
    expect(clock.currentTimeMs()).toBeCloseTo(140);
    expect(clock.sample().open).toBeGreaterThan(0.7);
    context.currentTime += 0.22;
    expect(clock.currentTimeMs()).toBeCloseTo(360);
    expect(clock.sample().open).toBeCloseTo(0.015);
  });

  it("holds the mouth at rest while a licensed line is paused or complete", () => {
    const pose = { open: 0.8, wide: 0.9, round: 0.6 };
    expect(RESTING_VOICE_CLOCK.sample(pose)).toEqual({ open: 0.015, wide: 0.1, round: 0 });
  });
});
