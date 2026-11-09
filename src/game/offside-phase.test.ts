import { describe, expect, it, vi } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim, type SimPlayer, type Side } from "./sim";
import { snapshotMatch } from "./live-match";
import { recoverMatch } from "./match-recovery";

function scene(receiverX: number, side: Side = "home") {
  const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "offside-touch", {
    rulesRevision: 2,
  });
  sim.time = 10;
  sim.restartTimer = sim.exemptUntil = 0;
  const dir = side === "home" ? 1 : -1;
  const kicker = sim.players.find((p) => p.side === side && p.pos === "FW")!;
  const receiver = sim.players.find((p) => p.side === side && p.pos === "MF")!;
  let opponents = 0;
  for (const player of sim.players) {
    player.z = 0;
    player.vx = player.vz = 0;
    if (player.side !== side) player.x = ([50, 30, 18, 5][opponents++] ?? -15) * dir;
    else {
      player.x = -30 * dir;
      player.sentOff = player !== kicker && player !== receiver && player.pos !== "GK";
    }
  }
  kicker.x = 10 * dir;
  receiver.x = receiverX * dir;
  sim.ball.x = kicker.x;
  sim.ball.z = 0;
  sim.ball.holder = kicker.id;
  sim.possession = side;
  return { sim, kicker, receiver };
}

function pass(sim: MatchSim, kicker: SimPlayer) {
  Reflect.get(sim, "decide").call(sim, kicker);
  expect(sim.pass).not.toBeNull();
}

describe("offside at the teammate's touch in rules revision 2", () => {
  it("uses the same touch-time rule for the away direction", () => {
    const { sim, kicker, receiver } = scene(35, "away");
    try {
      pass(sim, kicker);
      receiver.x = -29;
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.stats.away.offsides).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it("allows an onside runner to go beyond the defenders during the flight", () => {
    const { sim, kicker, receiver } = scene(29);
    try {
      pass(sim, kicker);
      receiver.x = 35;
      sim.time += 2;
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(0);
    } finally {
      sim.dispose();
    }
  });

  it("penalizes an offside runner who returns behind the line before receiving", () => {
    const { sim, kicker, receiver } = scene(35);
    try {
      pass(sim, kicker);
      receiver.x = 29;
      sim.time += 2;
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(1);
      expect(sim.events.at(-1)?.type).toBe("offside");
    } finally {
      sim.dispose();
    }
  });

  it("keeps offside eligibility through an opponent's block without control", () => {
    const { sim, kicker, receiver } = scene(35);
    try {
      pass(sim, kicker);
      const blocker = sim.players.find((p) => p.side === "away" && p.pos !== "GK")!;
      sim.ball.x = blocker.x;
      sim.ball.z = blocker.z;
      const random = vi.spyOn(sim, "rnd").mockReturnValue(0);
      expect(sim.tryBlock(1 / 30)).toBe(true);
      random.mockRestore();
      receiver.x = 29;
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it("resets eligibility after an opponent controls the ball deliberately", () => {
    const { sim, kicker, receiver } = scene(35);
    try {
      pass(sim, kicker);
      const defender = sim.players.find((p) => p.side === "away")!;
      const random = vi.spyOn(sim, "rnd").mockReturnValue(0);
      sim.controlBall(defender, 1, 0.12);
      expect(sim.ball.holder).toBe(defender.id);
      random.mockRestore();
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(0);
    } finally {
      sim.dispose();
    }
  });

  it("applies throw-in exemption to the first launch even after a long flight", () => {
    const { sim, kicker, receiver } = scene(35);
    try {
      sim.restartFor("home", "throwIn");
      expect(sim.ball.holder).toBe(kicker.id);
      pass(sim, kicker);
      sim.time += 5;
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(0);
    } finally {
      sim.dispose();
    }
  });

  it("does not flag an attacker behind the ball at the teammate's touch", () => {
    const { sim, kicker, receiver } = scene(35);
    try {
      kicker.x = 40;
      sim.ball.x = kicker.x;
      sim.shoot(kicker, 12.5);
      receiver.x = 45;
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(0);
    } finally {
      sim.dispose();
    }
  });

  it("ends direct-restart exemption when a teammate spills the first touch", () => {
    const { sim, kicker, receiver } = scene(35);
    try {
      sim.restartFor("home", "throwIn");
      pass(sim, kicker);
      kicker.x = 40;
      sim.ball.x = receiver.x;
      const random = vi.spyOn(sim, "rnd").mockReturnValue(1);
      sim.controlBall(receiver, 20, 0.12);
      random.mockRestore();
      expect(sim.ball.holder).toBeNull();
      kicker.x = 29;
      sim.controlBall(kicker, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it("applies goal-kick exemption only until the next teammate's touch", () => {
    const { sim, receiver } = scene(35);
    try {
      sim.scheduleRestart("home");
      const goalkeeper = sim.players.find((p) => p.id === sim.ball.holder)!;
      sim.noteOffsideKick(goalkeeper, sim.ball.x);
      expect(sim.checkpoint().rulesState?.phase).toBeNull();
      sim.time += 5;
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(0);
      const next = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
      next.x = 40;
      sim.ball.x = receiver.x;
      sim.noteOffsideKick(receiver, sim.ball.x);
      next.x = 29;
      sim.controlBall(next, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it("clears the old phase for a corner and captures the following instantaneous header", () => {
    const { sim, kicker } = scene(35);
    try {
      pass(sim, kicker);
      sim.setupCorner("home");
      expect(sim.checkpoint().rulesState?.phase).toBeNull();
      const takerId = sim.setPiece!.takerId;
      const header = sim.players.find(
        (p) => p.side === "home" && p.id !== takerId && !p.sentOff && p.pos !== "GK",
      )!;
      header.physical = header.shooting = 100;
      header.x = 40;
      for (const p of sim.players.filter((p) => p.side === "away")) p.physical = p.defending = 0;
      const random = vi.spyOn(sim, "rnd").mockReturnValue(0.2);
      sim.takeCorner();
      random.mockRestore();
      expect(sim.pendingShot?.shooter).toBe(header.id);
      expect(sim.stats.home.offsides).toBe(0);
      expect(sim.checkpoint().rulesState?.phase?.kickerId).toBe(header.id);
      // The direct recipient is exempt; a later teammate touch is a new phase.
      expect(sim.checkpoint().rulesState?.phase?.offsideIds).not.toContain(header.id);
      expect(sim.checkpoint().rulesState?.phase?.offsideIds).toContain(takerId);
    } finally {
      sim.dispose();
    }
  });

  it("preserves the shooter-time phase after a goalkeeper's save rebound", () => {
    const { sim, kicker, receiver } = scene(35);
    try {
      sim.shoot(kicker, 42.5);
      sim.pendingShot!.outcome = "saved";
      sim.ball.x = 51;
      sim.ball.z = 0;
      sim.ball.height = 1;
      const random = vi.spyOn(sim, "rnd").mockReturnValue(0);
      expect(sim.resolveShot({ x: 40, z: 0, height: 1 })).toBe(true);
      random.mockRestore();
      expect(sim.ball.holder).toBeNull();
      receiver.x = 29;
      sim.controlBall(receiver, 1, 0.12);
      expect(sim.stats.home.offsides).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it("restores an active phase without accepting caller aliases or losing eligibility", async () => {
    const { sim, kicker, receiver } = scene(35);
    let restored: MatchSim | undefined;
    try {
      pass(sim, kicker);
      const checkpoint = sim.checkpoint();
      restored = await recoverMatch(
        checkpoint,
        { ...snapshotMatch(sim, 2), recovery: { checkpointSeq: 1, ticks: [] } },
        () => false,
      );
      checkpoint.rulesState!.phase!.offsideIds.length = 0;
      const target = restored.players.find((p) => p.id === receiver.id)!;
      target.x = 29;
      restored.controlBall(target, 1, 0.12);
      expect(restored.stats.home.offsides).toBe(1);
      expect(sim.checkpoint().rulesState?.phase?.offsideIds).toEqual([receiver.id]);
    } finally {
      sim.dispose();
      restored?.dispose();
    }
  });

  it("rejects forged, oversized, future and mismatched-side phase snapshots atomically", () => {
    const { sim, kicker, receiver } = scene(35);
    try {
      pass(sim, kicker);
      const before = sim.checkpoint();
      const validPhase = {
        side: "home",
        kickerId: kicker.id,
        kickedAt: 10,
        ballX: 10,
        offsideIds: [receiver.id],
      };
      for (const phase of [
        { ...validPhase, side: "away" },
        { ...validPhase, kickedAt: 11 },
        { ...validPhase, offsideIds: ["home-forged"] },
        { ...validPhase, offsideIds: Array(12).fill(receiver.id) },
        { ...validPhase, offsideIds: [receiver.id, receiver.id] },
        { ...validPhase, kickerId: receiver.id },
        { ...validPhase, ballX: Infinity },
      ]) {
        expect(() =>
          sim.restoreCheckpoint({
            ...before,
            rulesState: { version: 2, phase, restart: null, indirect: null },
          } as never),
        ).toThrow(/rules state/i);
        expect(sim.checkpoint()).toEqual(before);
      }
      for (const rulesState of [
        undefined,
        { version: 3, phase: validPhase, restart: null, indirect: null },
        {
          version: 2,
          phase: null,
          restart: { side: "away", kind: "throwIn", takerId: kicker.id },
          indirect: null,
        },
        { version: 2, phase: validPhase, restart: null, indirect: null, extra: true },
      ]) {
        expect(() => sim.restoreCheckpoint({ ...before, rulesState } as never)).toThrow(
          /rules state/i,
        );
        expect(sim.checkpoint()).toEqual(before);
      }
    } finally {
      sim.dispose();
    }
  });
});
