import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim, MATCH_SIMULATION_STEP } from "./sim";
import { validExecutionContract } from "./match-execution-contract";
import { pressure } from "./sim-ball-duels";

const create = (seed: string, revision?: 2) =>
  new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed, {
    ...(revision ? { contactPhysicsRevision: revision } : {}),
  });

describe("opt-in contact physics / historical replay boundaries", () => {
  it("defaults to the historical unmodified execution contract", () => {
    const sim = create("contact-default");
    try {
      expect(sim.contactPhysicsRevision).toBeNull();
      expect(sim.executionContract()).not.toHaveProperty("contactPhysicsRevision");
      expect(validExecutionContract(sim.executionContract())).toBe(true);
    } finally {
      sim.dispose();
    }
  });

  it("rejects unknown contact models instead of silently downgrading", () => {
    const sim = create("contact-model", 2);
    try {
      expect(sim.executionContract().contactPhysicsRevision).toBe(2);
      expect(validExecutionContract(sim.executionContract())).toBe(true);
      expect(validExecutionContract({ ...sim.executionContract(), contactPhysicsRevision: 5 })).toBe(
        false,
      );
    } finally {
      sim.dispose();
    }
  });

  it("never warps the nearest player to a distant stationary ball after rescue timeout", () => {
    const sim = create("contact-no-teleport", 2);
    try {
      sim.ball.holder = null;
      sim.ball.x = 0;
      sim.ball.z = 0;
      sim.ball.vx = 0;
      sim.ball.vz = 0;
      sim.ball.height = 0.12;
      sim.ballVy = 0;
      sim.looseTime = 3.6;
      sim.pass = null;
      sim.pendingShot = null;
      sim.players.forEach((player, index) => {
        // Deliberately not overlapping and at least 16m away from the ball.
        player.x = 16 + (index % 11) * 2.2;
        player.z = index < 11 ? -10 : 10;
        player.vx = 0;
        player.vz = 0;
      });
      const before = new Map(sim.players.map((player) => [player.id, { x: player.x, z: player.z }]));
      sim.step(MATCH_SIMULATION_STEP, 6);
      expect(sim.ball.holder).toBeNull();
      for (const player of sim.players) {
        const prior = before.get(player.id)!;
        expect(Math.hypot(player.x - prior.x, player.z - prior.z)).toBeLessThan(1);
      }
    } finally {
      sim.dispose();
    }
  });

  it("does not grant possession on a tackle from 1.7 metres away", () => {
    const sim = create("contact-reach", 2);
    try {
      const holder = sim.players.find((player) => player.side === "home" && player.pos !== "GK")!;
      const challenger = sim.players.find((player) => player.side === "away" && player.pos !== "GK")!;
      sim.players.forEach((player) => {
        player.x = 28;
        player.z = player.side === "home" ? -12 : 12;
      });
      holder.x = 0;
      holder.z = 0;
      challenger.x = 1.7;
      challenger.z = 0;
      sim.ball.holder = holder.id;
      sim.possession = holder.side;
      pressure(sim, holder, 4);
      expect(sim.ball.holder).toBe(holder.id);
      expect(sim.possession).toBe(holder.side);
    } finally {
      sim.dispose();
    }
  });

  it("does not transfer possession when defender hits the body but misses the ball", () => {
    const sim = create("contact-missed-ball", 2);
    try {
      const holder = sim.players.find((player) => player.side === "home" && player.pos !== "GK")!;
      const challenger = sim.players.find((player) => player.side === "away" && player.pos !== "GK")!;
      sim.players.forEach((player) => {
        player.x = 25;
        player.z = player.side === "home" ? -12 : 12;
      });
      holder.x = 0;
      holder.z = 0;
      challenger.x = 0.8;
      challenger.z = 0;
      sim.ball.holder = holder.id;
      sim.ball.x = -0.8;
      sim.ball.z = 0;
      sim.possession = holder.side;
      pressure(sim, holder, 4);
      expect(sim.ball.holder).toBe(holder.id);
    } finally {
      sim.dispose();
    }
  });

  it("keeps deterministic state and revision through a checkpoint recovery", () => {
    const sim = create("contact-checkpoint", 2);
    const replay = create("contact-checkpoint", 2);
    try {
      for (let index = 0; index < 45; index += 1) sim.step(MATCH_SIMULATION_STEP, 6);
      const saved = sim.checkpoint();
      expect(saved.execution?.contactPhysicsRevision).toBe(2);
      replay.restoreCheckpoint(saved);
      expect(replay.contactPhysicsRevision).toBe(2);
      expect(replay.checkpoint()).toEqual(saved);
      for (let index = 0; index < 45; index += 1) {
        sim.step(MATCH_SIMULATION_STEP, 6);
        replay.step(MATCH_SIMULATION_STEP, 6);
      }
      expect(replay.checkpoint()).toEqual(sim.checkpoint());
    } finally {
      sim.dispose();
      replay.dispose();
    }
  });
});
