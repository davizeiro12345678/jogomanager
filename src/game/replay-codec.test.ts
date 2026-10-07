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
