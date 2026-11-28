import { describe, expect, it, vi } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { ReplayRecorder, ReplaySim, type ReplayFrame } from "./replay";
import {
  decodeReplay,
  encodeReplay,
  encodeStoredReplay,
  estimateReplayBytes,
  REPLAY_V3_MIN_REDUCTION,
  quantizeReplayComponent,
} from "./replay-codec";
import { emptyActionContext, emptyVersionedVisualData, getActionPhase } from "./visual-context";

function makeReplay() {
  const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "replay-codec");
  const recorder = new ReplayRecorder(sim);
  while (!sim.finished) {
    sim.step(0.25, 1);
    recorder.sample();
  }
  return recorder.build("Codec test");
}

function makeActionReplay() {
  const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "replay-action-clock");
  const recorder = new ReplayRecorder(sim);
  recorder.sample();
  const replay = recorder.build("Action clock");
  const first = replay.frames[0]!;
  const positions = first.p.map((coordinate) => coordinate || 0);
  const frame = (t: number, actionT?: number): ReplayFrame => {
    const actions = first.a.slice();
    actions[0] = "shot";
    const visual = emptyVersionedVisualData(replay.meta.length);
    if (actionT !== undefined)
      visual.actionContexts[0] = {
        ...emptyActionContext(),
        action: "shot",
        actionT,
        actionDur: 1,
        phase: getActionPhase(1 - actionT),
      };
    return { ...first, t, p: positions, a: actions, v: visual };
  };
  return { ...replay, frames: [frame(0, 0.75), frame(0.25, 0.5), frame(0.5, 0.9), frame(0.75)] };
}

describe("versioned replay codec", () => {
  it("quantizes replay positions to centimeters and clamps to signed int16", () => {
    expect(quantizeReplayComponent(1.25)).toBe(125);
    expect(quantizeReplayComponent(-1.25)).toBe(-125);
    expect(quantizeReplayComponent(400)).toBe(32_767);
    expect(quantizeReplayComponent(-400)).toBe(-32_768);
    expect(quantizeReplayComponent(327.68)).toBe(32_767);
    expect(quantizeReplayComponent(-327.69)).toBe(-32_768);
  });

  it("round-trips legacy-shaped replays with score, seek and visual context", () => {
    const original = makeReplay();
    const stored = encodeReplay(original);
    const decoded = decodeReplay(stored);
    const replay = new ReplaySim(decoded);

    expect(stored.version).toBe(3);
    expect(decoded.frames).toHaveLength(original.frames.length);
    // Verify packed coordinate parity at the first, middle and final frame.
    // Replays store centimeters; fractional original coordinates are rounded.
    for (const frameIndex of [
      0,
      Math.floor(original.frames.length / 2),
      original.frames.length - 1,
    ]) {
      const originalFrame = original.frames[frameIndex]!;
      const unpacked = decoded.frames[frameIndex]!;
      // The packed buffer is an Int16Array, so a quantized -0 reads back as 0.
      // Coordinates are equal; only the IEEE sign of zero differs.
      const packed = (coordinate: number) => (quantizeReplayComponent(coordinate) || 0) / 100;
      expect(Array.from(unpacked.p)).toEqual(Array.from(originalFrame.p, packed));
      expect(unpacked.b).toEqual(originalFrame.b.map(packed));
    }
    expect(decoded.score).toEqual(original.score);
    replay.seek(0);
    const start = replay.players.map((player) => [player.x, player.z]);
    replay.seek(Math.min(45 * 60, replay.duration));
    const middle = replay.players.map((player) => [player.x, player.z]);
    expect(start).not.toEqual(middle);
    expect(decoded.frames.at(-1)?.t).toBeCloseTo(original.frames.at(-1)?.t ?? 0, 2);
  });

  it("saturates packed positions without wrapping Int16 boundaries or sharing decode arrays", () => {
    const replay = makeReplay();
    const frame = replay.frames[0]!;
    const input = Array.from(frame.p);
    input.splice(0, 8, 327.675, -327.685, 0, -0, Number.NaN, Infinity, -Infinity, 2.345);
    const stored = encodeReplay({
      ...replay,
      frames: [
        { ...frame, p: input },
        { ...frame, t: frame.t + 1, p: input },
      ],
    });
    expect(Array.from(stored.frames.positions.slice(0, 8))).toEqual([
      32_767, -32_768, 0, 0, 0, 32_767, -32_768, 235,
    ]);
    const first = decodeReplay(stored);
    const second = decodeReplay(stored);
    expect(Array.from(first.frames[0]!.p).slice(0, 8)).toEqual([
      327.67, -327.68, 0, 0, 0, 327.67, -327.68, 2.35,
    ]);
    first.frames[0]!.p[0] = 10;
    expect(second.frames[0]!.p[0]).toBe(327.67);
    expect(first.frames[1]!.p[0]).toBe(327.67);
  });

  it("accepts unversioned and v2-shaped stored data", () => {
    const replay = makeReplay();
    expect(decodeReplay(replay)).toEqual(replay);
    expect(decodeReplay({ version: 2, ...replay })).toEqual(replay);
  });

  it("keeps consecutive packed frame offsets, actions and independent arrays aligned", () => {
    const replay = makeActionReplay();
    const frames = replay.frames.map((frame, index) => ({
      ...frame,
      t: index / 4,
      b: [index + 0.25, index - 0.5, index * 0.75] as ReplayFrame["b"],
      p: frame.p.map((_, coordinate) => (index * 80 + coordinate - 30) / 100),
      a: frame.a.map((_, player) => ((index + player) % 2 ? ("pass" as const) : ("shot" as const))),
      hg: index,
      ag: index + 1,
      poss: (index % 2 ? "away" : "home") as ReplayFrame["poss"],
    }));
    const decoded = decodeReplay(encodeReplay({ ...replay, frames }));
    for (let index = 0; index < frames.length; index += 1) {
      const actual = decoded.frames[index]!;
      const expected = frames[index]!;
      expect(actual.t).toBe(expected.t);
      expect(actual.b).toEqual(expected.b);
      expect(actual.p).toEqual(expected.p);
      expect(actual.a).toEqual(expected.a);
      expect([actual.hg, actual.ag, actual.poss]).toEqual([
        expected.hg,
        expected.ag,
        expected.poss,
      ]);
      expect(actual.v).toBe(expected.v);
    }
    decoded.frames[0]!.p[0] = 999;
    expect(decoded.frames[1]!.p[0]).toBe(frames[1]!.p[0]);
  });

  it("preserves the frame shape when one v3 replay mixes visual and older frames", () => {
    const replay = makeActionReplay();
    const first = replay.frames[0]!;
    const { v: _visual, ...older } = replay.frames[1]!;
    const stored = encodeReplay({ ...replay, frames: [first, older] });
    const decoded = decodeReplay(stored);

    expect(decoded.frames[0]!.v).toBe(first.v);
    expect(Object.hasOwn(decoded.frames[1]!, "v")).toBe(false);
    expect(decoded.frames.map((frame) => ({ ...frame, p: Array.from(frame.p) }))).toEqual([
      first,
      older,
    ]);
  });

  it.each([2, 3])("restores the recorded action clock when playing a v%s replay", (version) => {
    const replay = makeActionReplay();
    const recordedFrames = structuredClone(replay.frames);
    const decoded = decodeReplay(version === 3 ? encodeReplay(replay) : { ...replay, version });
    const playback = new ReplaySim(decoded);
    const athlete = playback.players[0]!;
    expect(athlete.actionDur).toBe(1);
    expect(athlete.actionT).toBe(0.75);
    playback.seek(0.125);
    expect(athlete.actionT).toBeCloseTo(0.625);
    playback.seek(0.225);
    expect(playback.generateVisualContext().actionContexts[0]).toMatchObject({ phase: "contact" });
    expect(playback.generateVisualContext().actionContexts[0]?.actionT).toBe(athlete.actionT);
    playback.seek(0.375);
    expect(athlete.actionT).toBe(0.5);
    playback.seek(0.5);
    expect(athlete.actionT).toBe(0.9);
    expect(decoded.frames.map((frame) => ({ ...frame, p: Array.from(frame.p) }))).toEqual(
      recordedFrames,
    );
  });

  it("keeps the old action pose when no usable clock was recorded", () => {
    const replay = makeActionReplay();
    const first = replay.frames[0]!;
    const corrupt = first.v!.actionContexts[0]!;
    corrupt.actionT = Infinity;
    const playback = new ReplaySim(replay);
    expect(playback.players[0]).toMatchObject({ action: "shot", actionT: 0.3, actionDur: 0.6 });

    delete first.v;
    const legacy = new ReplaySim(replay);
    expect(legacy.players[0]).toMatchObject({ action: "shot", actionT: 0.3, actionDur: 0.6 });
  });

  it("presents the recorded score and action of the final frame", () => {
    const replay = makeActionReplay();
    const final = replay.frames.at(-1)!;
    final.a[0] = null;
    final.hg = 1;
    final.poss = "away";
    const playback = new ReplaySim(replay);
    playback.seek(playback.duration);
    expect(playback.stats.home.goals).toBe(1);
    expect(playback.possession).toBe("away");
    expect(playback.players[0]).toMatchObject({ action: null, actionT: 0, actionDur: 0 });
  });

  it("counts exact UTF-8 replay bytes without encoding the entire frame history at once", () => {
    const fixture = makeActionReplay();
    const replay = {
      ...fixture,
      title: "Ação ⚽ 𐐷",
      frames: Array.from({ length: 64 }, (_, i) => ({
        ...fixture.frames[i % fixture.frames.length]!,
        t: i,
      })),
    };
    const stored = encodeReplay(replay);
    const text = new TextEncoder();
    const expectedV2 = text.encode(JSON.stringify(replay)).byteLength;
    const envelope = {
      version: stored.version,
      id: stored.id,
      createdAt: stored.createdAt,
      title: stored.title,
      home: stored.home,
      away: stored.away,
      meta: stored.meta,
      score: stored.score,
      visual: stored.frames.visual,
    };
    const expectedV3 =
      text.encode(JSON.stringify(envelope)).byteLength +
      [
        stored.frames.timesMs,
        stored.frames.ball,
        stored.frames.positions,
        stored.frames.actions,
        stored.frames.score,
        stored.frames.possession,
      ].reduce((sum, value) => sum + value.byteLength, 0);
    const original = TextEncoder.prototype.encode;
    let largest = 0;
    const spy = vi.spyOn(TextEncoder.prototype, "encode").mockImplementation(function (
      this: TextEncoder,
      input?: string,
    ) {
      largest = Math.max(largest, input?.length ?? 0);
      return original.call(this, input);
    });
    try {
      const report = estimateReplayBytes(replay, stored);
      expect(report.v2Bytes).toBe(expectedV2);
      expect(report.v3Bytes).toBe(expectedV3);
      expect(report.reductionRatio).toBe(1 - expectedV3 / expectedV2);
      expect(largest).toBeLessThan(expectedV2 / 2);
    } finally {
      spy.mockRestore();
    }
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
    const decoded = decodeReplay(stored);
    expect(encodeReplay(decoded).frames.positions).toEqual(stored.frames.positions);
    const legacy = encodeStoredReplay(decoded);
    expect(legacy.version).toBe(2);
    const roundTrip = decodeReplay(JSON.parse(JSON.stringify(legacy)));
    expect(roundTrip.frames[0]!.p).toEqual(Array.from(decoded.frames[0]!.p));
  });
});
