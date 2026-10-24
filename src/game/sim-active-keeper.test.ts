import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim, FIELD_X } from "./sim";
import type { Side, SimPlayer } from "./sim-types";

const create = () => new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "active-keeper");
const access = (sim: MatchSim) =>
  sim as unknown as {
    sendOff(p: SimPlayer, reason: string): void;
    scheduleRestart(side: Side): void;
    kickoff(side: Side): void;
    setupShootoutKick(): void;
    moveBall(dt: number, usePhysics: boolean): void;
    shootoutTurn: Side;
    shoot(p: SimPlayer, distance: number): void;
    pendingShot: { outcome: "saved" };
    resolveShot(previous: { x: number; z: number; height: number }): boolean;
  };

describe("only eligible players keep goal and restart play", () => {
  it("does not transfer an outgoing emergency keeper's role marker to a natural reserve keeper", () => {
    const sim = create();
    try {
      const internal = access(sim);
      internal.sendOff(
        sim.players.find((p) => p.side === "home" && p.pos === "GK")!,
        "test",
      );
      const emergency = sim.players.find((p) => p.side === "home" && p.emergencyKeeper)!;
      const reserve = sim.home.bench!.find((p) => p.pos === "GK")!;
      expect(sim.substitute("home", emergency.pid, reserve)).toBe(true);
      const incoming = sim.players.find((p) => p.pid === reserve.id)!;
      expect(incoming.emergencyKeeper).toBeUndefined();
      internal.scheduleRestart("home");
      expect(incoming.pos).toBe("GK");
      expect(sim.ball.holder).toBe(incoming.id);
    } finally {
      sim.dispose();
    }
  });
  it("keeps the active keeper when no dismissal occurred", () => {
    const sim = create();
    const keeper = sim.players.find((p) => p.side === "home" && p.pos === "GK")!;
    access(sim).scheduleRestart("home");
    expect(sim.ball.holder).toBe(keeper.id);
    sim.dispose();
  });

  it("uses an active emergency keeper after a dismissal without restoring the dismissed player", () => {
    const sim = create();
    const keeper = sim.players.find((p) => p.side === "home" && p.pos === "GK")!;
    const internal = access(sim);
    internal.sendOff(keeper, "test");
    internal.scheduleRestart("home");
    expect(keeper.sentOff).toBe(true);
    expect(sim.ball.holder).not.toBe(keeper.id);
    expect(sim.players.find((p) => p.id === sim.ball.holder)!.sentOff).toBe(false);
    expect(
      sim.players.filter((p) => p.side === "home" && p.pos === "GK" && !p.sentOff),
    ).toHaveLength(1);
    expect(sim.players.filter((p) => p.side === "home" && !p.sentOff)).toHaveLength(10);
    sim.dispose();
  });

  it("credits a save to the eligible keeper instead of the dismissed one", () => {
    const sim = create();
    const internal = access(sim);
    const keeper = sim.players.find((p) => p.side === "away" && p.pos === "GK")!;
    internal.sendOff(keeper, "test");
    const shooter = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
    internal.shoot(shooter, 20);
    internal.pendingShot.outcome = "saved";
    sim.ball.x = FIELD_X + 0.2;
    sim.ball.z = 0;
    sim.ball.height = 0.5;
    internal.resolveShot({ x: 50, z: 0, height: 0.5 });
    expect(keeper.saves).toBe(0);
    expect(sim.players.find((p) => p.side === "away" && p.pos === "GK" && !p.sentOff)!.saves).toBe(
      1,
    );
    sim.dispose();
  });

  it("selects a legitimate active backup ahead of the dismissed keeper", () => {
    const sim = create();
    const keeper = sim.players.find((p) => p.side === "home" && p.pos === "GK")!;
    const backup = sim.players.find((p) => p.side === "home" && p.pos === "DF")!;
    backup.pos = "GK";
    const internal = access(sim);
    internal.sendOff(keeper, "test");
    internal.scheduleRestart("home");
    expect(sim.ball.holder).toBe(backup.id);
    sim.dispose();
  });

  it("does not revive a dismissed keeper for a shootout", () => {
    const sim = create();
    const keeper = sim.players.find((p) => p.side === "away" && p.pos === "GK")!;
    const internal = access(sim);
    internal.sendOff(keeper, "test");
    internal.shootoutTurn = "home";
    internal.setupShootoutKick();
    expect(keeper.sentOff).toBe(true);
    sim.dispose();
  });

  it("never gives a kickoff to a dismissed forward", () => {
    const sim = create();
    const internal = access(sim);
    const forward = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
    internal.sendOff(forward, "test");
    internal.kickoff("home");
    expect(sim.ball.holder).not.toBe(forward.id);
    expect(sim.players.find((p) => p.id === sim.ball.holder)!.sentOff).toBe(false);
    sim.dispose();
  });

  it("releases a stale legacy holder instead of moving a dismissed player", () => {
    const sim = create();
    const keeper = sim.players.find((p) => p.side === "home" && p.pos === "GK")!;
    const internal = access(sim);
    internal.sendOff(keeper, "test");
    sim.ball.holder = keeper.id;
    sim.ball.x = sim.ball.z = 0;
    internal.moveBall(1 / 30, false);
    expect(sim.ball.holder).not.toBe(keeper.id);
    expect(keeper.sentOff).toBe(true);
    sim.dispose();
  });

  it("returns an emergency keeper to their outfield role when a bench keeper enters", () => {
    const sim = create();
    const original = sim.players.find((p) => p.side === "home" && p.pos === "GK")!;
    const internal = access(sim);
    internal.sendOff(original, "test");
    const emergency = sim.players.find((p) => p.side === "home" && p.emergencyKeeper)!;
    const role = { ...emergency.emergencyKeeper! };
    const outgoing = sim.players.find((p) => p.side === "home" && !p.sentOff && p !== emergency)!;
    const reserve = sim.home.bench!.find((p) => p.pos === "GK")!;
    expect(sim.substitute("home", outgoing.pid, reserve)).toBe(true);
    internal.scheduleRestart("home");
    expect(sim.players.find((p) => p.id === sim.ball.holder)!.pid).toBe(reserve.id);
    expect(emergency.pos).toBe(role.pos);
    expect(emergency.slotX).toBe(role.slotX);
    expect(emergency.emergencyKeeper).toBeUndefined();
    sim.dispose();
  });

  it("recovers the emergency role and rejects invalid or unknown role metadata atomically", () => {
    const sim = create();
    const keeper = sim.players.find((p) => p.side === "home" && p.pos === "GK")!;
    access(sim).sendOff(keeper, "test");
    const checkpoint = sim.checkpoint();
    const recovered = create();
    recovered.restoreCheckpoint(checkpoint);
    expect(recovered.checkpoint()).toEqual(checkpoint);
    for (const marker of [
      { pos: "DF", slotX: NaN, slotZ: 0 },
      { pos: "GK", slotX: 0, slotZ: 0 },
      { pos: "DF", slotX: 0, slotZ: 0, sentOff: false },
    ]) {
      const broken = structuredClone(checkpoint);
      const players = broken.state["players"] as SimPlayer[];
      players.find((p) => p.emergencyKeeper)!.emergencyKeeper = marker;
      const invalidTarget = create();
      const before = invalidTarget.checkpoint();
      expect(() => invalidTarget.restoreCheckpoint(broken)).toThrow(/emergency keeper/);
      expect(invalidTarget.checkpoint()).toEqual(before);
      invalidTarget.dispose();
    }
    recovered.dispose();
    sim.dispose();
  });
});
