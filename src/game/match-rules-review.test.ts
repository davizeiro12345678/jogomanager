import { describe, expect, it, vi } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { FIELD_X, MatchSim } from "./sim";
import { GOAL_Z } from "./sim-rules";

function match() {
  return new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "review2", {
    rulesRevision: 2,
  });
}

function indirect() {
  const sim = match();
  sim.time = 10;
  for (const p of sim.players) {
    p.x = p.side === "away" ? 20 : 0;
    p.z = 0;
    p.vx = p.vz = 0;
  }
  const taker = sim.players.find((p) => p.side === "away" && p.pos === "FW")!;
  taker.x = -49;
  sim.ball.x = -49;
  sim.ball.z = 0;
  sim.restartFor("away", "indirectFK");
  return { sim, taker };
}

function directAttempt() {
  const { sim, taker } = indirect();
  const random = vi.spyOn(sim, "rnd").mockReturnValue(0);
  Reflect.get(sim, "decide").call(sim, taker);
  random.mockRestore();
  expect(sim.pendingShot?.outcome).toBe("goal");
  expect(sim.stats.away.passes).toBe(0);
  return { sim, taker };
}

function crossGoal(sim: MatchSim) {
  sim.ball.x = -51;
  sim.ball.z = 0;
  sim.ball.height = 0.5;
  expect(sim.resolveShot({ x: -49, z: 0, height: 0.25 })).toBe(true);
}

describe("independently reproduced revision 2 rule regressions", () => {
  it.each(["shot", "pass"])("uses the real ball coordinate for an open-play %s", (kind) => {
    const sim = match();
    try {
      for (const p of sim.players) {
        p.x = p.side === "away" ? 20 : 0;
        p.z = 0;
      }
      const kicker = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
      const runner = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
      kicker.x = 30;
      runner.x = 30.75;
      sim.ball.x = 30.9;
      sim.ball.holder = kicker.id;
      const random = vi.spyOn(sim, "rnd").mockReturnValue(0.99);
      if (kind === "shot") sim.shoot(kicker, 22.5);
      else Reflect.get(sim, "decide").call(sim, kicker);
      random.mockRestore();
      expect(sim.checkpoint().rulesState?.phase?.ballX).toBe(30.9);
      expect(sim.offsideAtContact(runner)).toBe(false);
    } finally {
      sim.dispose();
    }
  });

  it("restarts with a goal kick instead of counting a direct indirect-free-kick goal", () => {
    const { sim } = directAttempt();
    try {
      crossGoal(sim);
      expect(sim.stats.away.goals).toBe(0);
      expect(sim.scorers).toEqual([]);
      expect(sim.checkpoint().rulesState?.restart?.kind).toBe("goalKick");
      expect(sim.players.find((p) => p.id === sim.ball.holder)?.side).toBe("home");
    } finally {
      sim.dispose();
    }
  });

  it("restarts with a corner if the direct indirect kick is credited as an own goal", () => {
    const { sim, taker } = directAttempt();
    try {
      sim.scoreGoal("home", taker, taker.x, taker.z);
      expect(sim.stats.home.goals).toBe(0);
      expect(sim.stats.home.corners).toBe(1);
      expect(sim.setPiece?.kind).toBe("corner");
    } finally {
      sim.dispose();
    }
  });

  it("allows a goal once a different teammate has touched the indirect kick", () => {
    const { sim, taker } = indirect();
    try {
      const receiver = sim.players.find((p) => p.side === "away" && p.pos === "MF")!;
      receiver.x = -45;
      const random = vi.spyOn(sim, "rnd").mockReturnValue(0.99);
      Reflect.get(sim, "decide").call(sim, taker);
      expect(sim.pass?.to).toBe(receiver.id);
      random.mockReturnValue(0);
      sim.ball.x = receiver.x;
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.ball.holder).toBe(receiver.id);
      sim.shoot(receiver, 7.5);
      random.mockRestore();
      crossGoal(sim);
      expect(sim.stats.away.goals).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it("does not treat a post rebound as a second player's touch", () => {
    const { sim, taker } = directAttempt();
    try {
      sim.woodworkOrRelease(sim.pendingShot!, taker, GOAL_Z, 1, -1);
      sim.scoreGoal("away", taker, taker.x, taker.z);
      expect(sim.stats.away.goals).toBe(0);
      expect(sim.checkpoint().rulesState?.restart?.kind).toBe("goalKick");
    } finally {
      sim.dispose();
    }
  });

  it("preserves the direct-goal restriction through checkpoint recovery", () => {
    const { sim } = directAttempt();
    const recovered = match();
    try {
      const checkpoint = sim.checkpoint();
      recovered.restoreCheckpoint(checkpoint);
      crossGoal(recovered);
      expect(recovered.stats.away.goals).toBe(0);
      expect(recovered.checkpoint().rulesState?.restart?.kind).toBe("goalKick");
    } finally {
      sim.dispose();
      recovered.dispose();
    }
  });

  it("rejects future or forged indirect-kick recovery metadata before mutation", () => {
    const { sim } = directAttempt();
    try {
      const checkpoint = sim.checkpoint();
      for (const change of [{ kickedAt: 11 }, { side: "home" }, { takerId: "away-forged" }]) {
        const altered = structuredClone(checkpoint);
        Reflect.set(altered.rulesState!, "indirect", {
          side: "away",
          takerId: sim.players.find((p) => p.side === "away" && p.pos === "FW")!.id,
          awardedAt: 10,
          kickedAt: 10,
          ...change,
        });
        expect(() => sim.restoreCheckpoint(altered)).toThrow(/rules state/i);
        expect(sim.checkpoint()).toEqual(checkpoint);
      }
    } finally {
      sim.dispose();
    }
  });

  it("never assigns an indirect kick to a sent-off outfielder", () => {
    const sim = match();
    try {
      for (const p of sim.players.filter((p) => p.side === "away")) {
        p.x = 20;
        p.z = 15;
      }
      const dismissed = sim.players.find((p) => p.side === "away" && p.pos === "DF")!;
      dismissed.x = 1;
      sim.sendOff(dismissed, "fixture");
      sim.ball.x = FIELD_X - 1;
      sim.ball.z = 33;
      sim.restartFor("away", "indirectFK");
      expect(sim.ball.holder).not.toBe(dismissed.id);
      expect(sim.players.find((p) => p.id === sim.ball.holder)?.sentOff).toBe(false);
    } finally {
      sim.dispose();
    }
  });

  it("uses an active outfielder when the goalkeeper is unavailable", () => {
    const sim = match();
    try {
      const dismissed = sim.players.find((p) => p.side === "home" && p.pos === "GK")!;
      sim.sendOff(dismissed, "fixture");
      sim.scheduleRestart("home");
      expect(sim.ball.holder).not.toBe(dismissed.id);
      expect(sim.players.find((p) => p.id === sim.ball.holder)?.sentOff).toBe(false);
    } finally {
      sim.dispose();
    }
  });

  it("does not restore a dismissed forward as the kickoff taker after a goal", () => {
    const sim = match();
    try {
      const dismissed = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
      sim.sendOff(dismissed, "fixture");
      sim.scoreGoal("away", null, -45, 0);
      expect(sim.ball.holder).not.toBe(dismissed.id);
      expect(sim.players.find((p) => p.id === sim.ball.holder)?.sentOff).toBe(false);
    } finally {
      sim.dispose();
    }
  });
});
