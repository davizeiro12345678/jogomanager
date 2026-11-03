import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { ReplayRecorder, ReplaySim } from "./replay";
import {
  decodeReplay,
  encodeReplay,
  encodeStoredReplay,
  estimateReplayBytes,
  REPLAY_V3_MIN_REDUCTION,
} from "./replay-codec";

function makeReplay() {
  const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "replay-codec");
  const recorder = new ReplayRecorder(sim);
  while (!sim.finished) {
    sim.step(0.25, 1);
    recorder.sample();
  }
  return recorder.build("Codec test");
}

describe("versioned replay codec", () => {
  it("preserves int16 saturation, rounding and non-finite conversion at the codec boundary", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "codec-boundaries");
    const recorder = new ReplayRecorder(sim);
    recorder.sample();
    const replay = recorder.build("Boundary values");
    const values = [
      -Infinity,
      -400,
      -327.68,
      -327.675,
      -1.235,
      -0.005,
      -0,
      0,
      0.005,
      1.235,
      327.665,
      327.67,
      400,
      Infinity,
      NaN,
    ];
    const frame = replay.frames[0]!;
    frame.b = [NaN, Infinity, -Infinity];
    frame.p = frame.p.map((_, index) => values[index % values.length]!);
    const expected = Int16Array.from(frame.p, (value) =>
      Math.max(-32_768, Math.min(32_767, Math.round(value * 100))),
    );
    const stored = encodeReplay(replay);
    expect(stored.frames.positions).toEqual(expected);
    expect(stored.frames.ball).toEqual(new Int16Array([0, 32_767, -32_768]));
    const decoded = decodeReplay(stored);
    expect(decoded.frames[0]!.p).toEqual(Array.from(expected, (value) => value / 100));
  });

  it("round-trips legacy-shaped replays with score, seek and visual context", () => {
    const original = makeReplay();
    const stored = encodeReplay(original);
    const decoded = decodeReplay(stored);
    const replay = new ReplaySim(decoded);

    expect(stored.version).toBe(3);
    expect(decoded.frames).toHaveLength(original.frames.length);
    expect(decoded.score).toEqual(original.score);
    replay.seek(0);
    const start = replay.players.map((player) => [player.x, player.z]);
    replay.seek(Math.min(45 * 60, replay.duration));
    const middle = replay.players.map((player) => [player.x, player.z]);
    expect(start).not.toEqual(middle);
    expect(decoded.frames.at(-1)?.t).toBeCloseTo(original.frames.at(-1)?.t ?? 0, 2);
  });

  it("accepts unversioned and v2-shaped stored data", () => {
    const replay = makeReplay();
    expect(decodeReplay(replay)).toEqual(replay);
    expect(decodeReplay({ version: 2, ...replay })).toEqual(replay);
  });

  it("reports the byte comparison used to decide whether v3 is justified", () => {
    const replay = makeReplay();
    const stored = encodeReplay(replay);
    const report = estimateReplayBytes(replay, stored);
    console.log(`REPLAY_SIZE ${JSON.stringify(report)}`);
    expect(report.v3Bytes).toBeLessThan(report.v2Bytes);
    expect(report.frameCount).toBe(replay.frames.length);
    expect(report.reductionRatio).toBeLessThan(REPLAY_V3_MIN_REDUCTION);
    expect(encodeStoredReplay(replay)).toMatchObject({ version: 2 });
  });
});
