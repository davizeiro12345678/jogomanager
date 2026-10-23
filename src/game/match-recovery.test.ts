import { describe, expect, it } from "vitest";
import { MatchSim } from "./sim";
import { buildTeamSetup } from "./quickMatch";
import { snapshotMatch } from "./live-match";
import { recoverMatch } from "./match-recovery";
import { createRapierBallAuthority } from "./rapier-ball-authority";

describe("confirmed match recovery", () => {
  it("emits v2 and restores legacy v1 while rejecting v2 without its execution contract", () => {
    const create = () =>
      new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "checkpoint-envelope");
    const source = create();
    const legacyTarget = create();
    const invalidTarget = create();
    try {
      source.step(1 / 30, 6);
      const checkpoint = source.checkpoint();
      expect(checkpoint.version).toBe(2);
      const legacy = { ...checkpoint, version: 1 as const };
      delete legacy.execution;
      legacyTarget.restoreCheckpoint(legacy);
      expect(legacyTarget.checkpoint()).toEqual(checkpoint);
      const invalid = { ...checkpoint };
      delete invalid.execution;
      const untouched = invalidTarget.checkpoint();
      expect(() => invalidTarget.restoreCheckpoint(invalid)).toThrow(/checkpoint/);
      expect(invalidTarget.checkpoint()).toEqual(untouched);
    } finally {
      source.dispose();
      legacyTarget.dispose();
      invalidTarget.dispose();
    }
  });
  it("rejects invalid integration journals before changing state, PRNG or physics", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "atomic-recovery");
    const restored = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "atomic-recovery");
    try {
      for (let i = 0; i < 12; i++) sim.step(1 / 30, 6);
      const current = sim.checkpoint();
      const untouched = restored.checkpoint();
      const older = structuredClone(current);
      older.state["time"] = 0;
      for (const remainders of [
        [],
        Array(sim.players.length).fill(NaN),
        Array(sim.players.length).fill(1),
      ]) {
        expect(() =>
          restored.restoreCheckpoint({ ...older, athleteRemainders: remainders }),
        ).toThrow(/athlete/);
        expect(sim.checkpoint()).toEqual(current);
        expect(restored.checkpoint()).toEqual(untouched);
      }
      expect(() => sim.restoreCheckpoint(current)).toThrow(/execution contract.*fixed/);
    } finally {
      sim.dispose();
      restored.dispose();
    }
  });
  for (const rapier of [false, true])
    it(`restores PRNG, commands and fixed ticks (${rapier ? "Rapier" : "compatible"})`, async () => {
      const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "recovery-checkpoint");
      let restored: MatchSim | undefined;
      try {
        if (rapier) sim.setBallPhysicsAuthority(await createRapierBallAuthority());
        for (let i = 0; i < 120; i++) sim.step(1 / 30, 6);
        sim.applyTeamTalk("home", "motivar");
        sim.home.tactics.mentality = 0;
        const checkpoint = sim.checkpoint();
        const ticks: Array<[number, number]> = [];
        for (let i = 0; i < 36; i++) {
          ticks.push([1 / 30, 6]);
          sim.step(1 / 30, 6);
        }
        const target = { ...snapshotMatch(sim, 2), recovery: { checkpointSeq: 1, ticks } };
        restored = await recoverMatch(checkpoint, target, () => false);
        expect(restored.players).toEqual(sim.players);
        expect(restored.stats).toEqual(sim.stats);
        for (let i = 0; i < 60; i++) {
          sim.step(1 / 30, 6);
          restored.step(1 / 30, 6);
        }
        expect(restored.players).toEqual(sim.players);
        expect(restored.ball).toEqual(sim.ball);
        expect(restored.events).toEqual(sim.events);
      } finally {
        sim.dispose();
        restored?.dispose();
      }
    });
  it("rejects divergence instead of restarting the score", async () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "recovery-failure");
    try {
      const checkpoint = sim.checkpoint();
      const target = {
        ...snapshotMatch(sim, 1),
        time: 20,
        recovery: { checkpointSeq: 1, ticks: [] },
      };
      await expect(recoverMatch(checkpoint, target, () => false)).rejects.toThrow(/confirmed/);
    } finally {
      sim.dispose();
    }
  });
});
