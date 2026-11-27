import { describe, expect, it } from "vitest";
import { initCareer, migrateCareer } from "./career";
import { validExecutionContract } from "./match-execution-contract";
import { validMatchCommand } from "./match-command-validation";
import { buildTeamSetup } from "./quickMatch";
import {
  MatchSim,
  MATCH_SIMULATION_STEP,
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_TICK_LIMIT,
} from "./sim";
import { defensiveLineX } from "./sim-rules";
import { moveOffBall } from "./sim-team-ai";
import { ReplayRecorder, ReplaySim } from "./replay";
import { decodeReplay, encodeReplay } from "./replay-codec";
import { recoverMatch } from "./match-recovery";
import { snapshotMatch } from "./live-match";

function match(rulesRevision?: unknown) {
  return Reflect.construct(MatchSim, [
    buildTeamSetup("fla"),
    buildTeamSetup("pal"),
    "match-rules-version",
    rulesRevision === undefined ? undefined : { rulesRevision },
  ]) as MatchSim;
}

describe("versioned match rule corrections", () => {
  it("preserves the legacy contract by omission and records revision 2 explicitly", () => {
    const legacy = match();
    const modern = match(2);
    try {
      expect(legacy.executionContract()).toEqual({
        revision: 2,
        physics: "compat",
        perception: "compat",
      });
      expect(modern.executionContract()).toEqual({
        revision: 2,
        physics: "compat",
        perception: "compat",
        rulesRevision: 2,
      });
      expect(Object.keys(modern)).toEqual(Object.keys(legacy));
    } finally {
      legacy.dispose();
      modern.dispose();
    }
  });

  it.each([0, 3, -1, "2", null, Infinity, NaN])("rejects an unknown rule revision %s", (value) => {
    expect(() => match(value)).toThrow(/rules revision/i);
    expect(
      validExecutionContract({
        revision: 2,
        physics: "compat",
        perception: "compat",
        rulesRevision: value,
      }),
    ).toBe(false);
    const start = {
      id: 1,
      type: "startLive",
      home: buildTeamSetup("fla"),
      away: buildTeamSetup("pal"),
      seed: "rules-admission",
      rulesRevision: value,
    };
    expect(validMatchCommand(start)).toBe(false);
    expect(validMatchCommand({ ...start, type: "simulate" })).toBe(false);
  });

  it("finds the second-last active opponent toward either goal only in revision 2", () => {
    const players = [5, 18, 30, 50].map((x) => ({
      x,
      side: "away" as const,
      pos: "DF",
      sentOff: false,
    }));
    players.push({ x: 51, side: "away", pos: "DF", sentOff: true });
    expect(defensiveLineX(players, "home")).toBe(18);
    expect(defensiveLineX(players, "home", 2)).toBe(30);
    const mirrored = players.map((p) => ({ ...p, x: -p.x, side: "home" as const }));
    expect(defensiveLineX(mirrored, "away")).toBe(-18);
    expect(defensiveLineX(mirrored, "away", 2)).toBe(-30);
  });

  it("activates a defensive line step for valid high pressing only in revision 2", () => {
    const old = match();
    const modern = match(2);
    const low = match(2);
    try {
      for (const sim of [old, modern, low]) {
        sim.home.tactics.pressing = sim === low ? 1 : 2;
        sim.possession = "away";
        sim.ball.x = 15;
        sim.ball.z = 6;
        sim.ball.holder = sim.players.find((p) => p.side === "away" && p.pos === "FW")!.id;
        for (const p of sim.players.filter((p) => p.side === "home" && p.pos === "DF")) {
          p.x = -20;
          p.vx = p.vz = 0;
        }
      }
      for (let tick = 0; tick < 30; tick++) {
        moveOffBall(old, 1 / 30);
        moveOffBall(modern, 1 / 30);
        moveOffBall(low, 1 / 30);
      }
      const defenders = (sim: MatchSim) =>
        sim.players.filter((p) => p.side === "home" && p.pos === "DF").map((p) => [p.x, p.z]);
      expect(defenders(modern)).not.toEqual(defenders(old));
      expect(defenders(low)).not.toEqual(defenders(modern));
    } finally {
      old.dispose();
      modern.dispose();
      low.dispose();
    }
  });

  it("persists revision 2 for new careers and preserves absent revision in old saves", () => {
    const career = initCareer("bra", "fla", "Rules audit");
    expect(career.matchRulesRevision).toBe(2);
    const { matchRulesRevision: _revision, ...legacy } = career;
    expect(migrateCareer(legacy).matchRulesRevision).toBeUndefined();
  });

  it("keeps revision 2 deterministic through recovery and recorded replay playback", async () => {
    const original = match(2);
    const duplicate = match(2);
    let recovered: MatchSim | undefined;
    try {
      const recorder = new ReplayRecorder(original);
      for (let i = 0; i < 240; i++) {
        original.step(1 / 30, 6);
        duplicate.step(1 / 30, 6);
        recorder.sample();
      }
      expect(original.checkpoint()).toEqual(duplicate.checkpoint());
      const checkpoint = original.checkpoint();
      const ticks: Array<[number, number]> = [];
      for (let i = 0; i < 24; i++) {
        ticks.push([1 / 30, 6]);
        original.step(1 / 30, 6);
        recorder.sample();
      }
      recovered = await recoverMatch(
        checkpoint,
        { ...snapshotMatch(original, 2), recovery: { checkpointSeq: 1, ticks } },
        () => false,
      );
      expect(recovered.executionContract().rulesRevision).toBe(2);
      expect(recovered.checkpoint()).toEqual(original.checkpoint());
      const decoded = decodeReplay(encodeReplay(recorder.build("Rules audit")));
      expect(decoded.execution?.rulesRevision).toBe(2);
      const replay = new ReplaySim(decoded);
      replay.seek(replay.duration);
      expect(replay.stats.home.goals).toBe(original.stats.home.goals);
      expect(replay.stats.away.goals).toBe(original.stats.away.goals);
    } finally {
      original.dispose();
      duplicate.dispose();
      recovered?.dispose();
    }
  });

  it.each(["rules-full-1", "rules-full-2", "rules-full-3"])(
    "finishes the revised engine with identical full-match state for %s",
    (seed) => {
      const create = () =>
        new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed, { rulesRevision: 2 });
      const first = create();
      const replayed = create();
      try {
        let ticks = 0;
        while (!first.finished && ticks++ < MATCH_SIMULATION_TICK_LIMIT) {
          first.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
          replayed.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
        }
        expect(first.finished).toBe(true);
        expect(replayed.finished).toBe(true);
        expect(first.checkpoint()).toEqual(replayed.checkpoint());
      } finally {
        first.dispose();
        replayed.dispose();
      }
    },
  );
});
