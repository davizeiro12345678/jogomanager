import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MATCH_SIMULATION_STEP, MatchSim } from "./sim";
import { createRapierBallAuthority } from "./rapier-ball-authority";
import type { SimPlayer } from "./sim-types";

type Internals = {
  rnd: () => number;
  decide(p: SimPlayer): void;
  pressure(p: SimPlayer, dt: number): void;
  controlBall(p: SimPlayer, speed: number, height: number): void;
  moveBall(dt: number, physics: boolean): void;
  moveOffBall(dt: number): void;
  chasers(): Set<string>;
  restartTimer: number;
  pass: { to: string } | null;
  setPiece: { kind: string } | null;
};
const create = () => new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "pass-contact");
const preparePass = () => {
  const sim = create();
  const internal = sim as unknown as Internals;
  const originalRng = internal.rnd;
  const passer = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
  const receiver = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
  for (const p of sim.players) {
    p.x = -40;
    p.z = 25;
    p.vx = p.vz = 0;
  }
  passer.x = passer.z = receiver.z = 0;
  receiver.x = 15;
  sim.ball.x = sim.ball.z = 0;
  sim.ball.holder = passer.id;
  sim.ball.offsideExemptFor = passer.id;
  internal.rnd = () => 0;
  internal.decide(passer);
  expect(internal.pass?.to).toBe(receiver.id);
  return { sim, internal, passer, receiver, originalRng };
};

describe("pass intent and physical delivery", () => {
  it.each(["receiveX", "receiveZ", "travelTime"])(
    "rejects nonfinite recovered pass %s before mutating the match",
    (key) => {
      const { sim, internal, originalRng } = preparePass();
      internal.rnd = originalRng;
      const checkpoint = sim.checkpoint();
      (checkpoint.state["pass"] as Record<string, unknown>)[key] = NaN;
      const restored = create();
      const before = restored.checkpoint();
      expect(() => restored.restoreCheckpoint(checkpoint)).toThrow(/pass/i);
      expect(restored.checkpoint()).toEqual(before);
      sim.dispose();
      restored.dispose();
    },
  );

  it("assigns the intended receiver instead of sending the passer after its unresolved release", () => {
    const { sim, internal, passer, receiver } = preparePass();
    const nearby = sim.players.find(
      (p) => p.side === "home" && p.pos !== "GK" && p !== passer && p !== receiver,
    )!;
    nearby.x = 4;
    nearby.z = 0;
    const chasers = internal.chasers();
    expect(chasers.has(receiver.id)).toBe(true);
    expect(chasers.has(passer.id)).toBe(false);
    expect(
      [...chasers].filter((id) => sim.players.find((p) => p.id === id)?.side === "home"),
    ).toHaveLength(2);
    sim.dispose();
  });

  it("holds the receiver at an open planned reception instead of running back into the passer", () => {
    const { sim, internal, receiver } = preparePass();
    for (let tick = 0; tick < 10; tick++) internal.moveOffBall(MATCH_SIMULATION_STEP);
    expect(receiver.x).toBeGreaterThan(14.99);
    expect(Math.abs(receiver.z)).toBeLessThan(0.01);
    sim.dispose();
  });

  it.each([false, true])(
    "counts a controlled teammate recovery after a failed first touch once (resume=%s)",
    (resume) => {
      const { sim, internal, receiver, originalRng } = preparePass();
      internal.rnd = () => 0.999;
      internal.controlBall(receiver, 28, 0.12);
      expect(sim.ball.holder).toBeNull();
      expect(sim.stats.home.passesOk).toBe(0);
      internal.rnd = originalRng;
      const active = resume ? create() : sim;
      if (resume) active.restoreCheckpoint(sim.checkpoint());
      const next = active as unknown as Internals;
      const teammate = active.players.find((p) => p.id === receiver.id)!;
      next.rnd = () => 0;
      next.controlBall(teammate, 3, 0.12);
      next.controlBall(teammate, 0, 0.12);
      expect(active.stats.home.passes).toBe(1);
      expect(active.stats.home.passesOk).toBe(1);
      expect(active.analytics.connections.reduce((sum, edge) => sum + edge.completed, 0)).toBe(1);
      expect(active.analytics.connections.every((edge) => edge.completed <= edge.attempts)).toBe(
        true,
      );
      if (resume) active.dispose();
      sim.dispose();
    },
  );

  it("ends the incomplete pass when an opponent takes the spilled first touch", () => {
    const { sim, internal, receiver } = preparePass();
    internal.rnd = () => 0.999;
    internal.controlBall(receiver, 28, 0.12);
    const opponent = sim.players.find((p) => p.side === "away" && p.pos === "DF")!;
    internal.rnd = () => 0;
    internal.controlBall(opponent, 0, 0.12);
    expect(sim.ball.holder).toBe(opponent.id);
    expect(internal.pass).toBeNull();
    expect(sim.stats.home.passesOk).toBe(0);
    expect(sim.stats.away.interceptions).toBe(1);
    sim.dispose();
  });

  it("allows the original passer to play a teammate's loose touch", () => {
    const { sim, internal, passer, receiver } = preparePass();
    internal.rnd = () => 0.999;
    internal.controlBall(receiver, 28, 0.12);
    for (const p of sim.players) {
      p.x = -40;
      p.z = 25;
    }
    sim.ball.x = sim.ball.z = 0;
    sim.ball.vx = 3;
    sim.ball.vz = 0;
    passer.x = 0.1;
    passer.z = 0;
    internal.rnd = () => 0;
    internal.moveBall(MATCH_SIMULATION_STEP, false);
    expect(sim.ball.holder).toBe(passer.id);
    expect(sim.stats.home.passesOk).toBe(0);
    sim.dispose();
  });

  it.each([false, true])(
    "delivers an uncontested 20 m pass without moving the receiver (Rapier=%s)",
    async (physics) => {
      const sim = create();
      const internal = sim as unknown as Internals;
      const passer = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
      const receiver = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
      for (const p of sim.players) {
        p.sentOff = p !== passer && p !== receiver;
        p.vx = p.vz = 0;
      }
      passer.x = passer.z = receiver.z = 0;
      receiver.x = 20;
      sim.ball.x = sim.ball.z = 0;
      sim.ball.holder = passer.id;
      sim.ball.offsideExemptFor = passer.id;
      internal.rnd = () => 0;
      if (physics) sim.setBallPhysicsAuthority(await createRapierBallAuthority());
      internal.decide(passer);
      expect(internal.pass?.to).toBe(receiver.id);
      for (let tick = 0; tick < 75 && sim.ball.holder === null; tick++)
        internal.moveBall(MATCH_SIMULATION_STEP, physics);
      expect(sim.ball.holder).toBe(receiver.id);
      expect(sim.stats.home.passesOk).toBe(1);
      expect(receiver.x).toBe(20);
      sim.dispose();
    },
  );

  it.each([true, false])("respects the actual progressive lane (blocked=%s)", (blocked) => {
    const sim = create();
    const internal = sim as unknown as Internals;
    const mates = sim.players.filter((p) => p.side === "home" && p.pos !== "GK");
    const [passer, forward, outlet] = mates as [SimPlayer, SimPlayer, SimPlayer];
    const blocker = sim.players.find((p) => p.side === "away" && p.pos === "DF")!;
    for (const p of sim.players) {
      p.sentOff = ![passer, forward, outlet, blocker].includes(p);
      p.vx = p.vz = 0;
    }
    passer.x = passer.z = forward.z = blocker.z = outlet.x = 0;
    forward.x = 30;
    blocker.x = 15;
    blocker.z = blocked ? 0 : -15;
    outlet.z = 8;
    sim.ball.holder = passer.id;
    sim.ball.offsideExemptFor = passer.id;
    internal.rnd = () => 0;
    internal.decide(passer);
    expect(internal.pass?.to).toBe(blocked ? outlet.id : forward.id);
    sim.dispose();
  });
});

describe("ball challenges and obvious opportunity", () => {
  const challenge = (behind: boolean, velocity: number) => {
    const sim = create();
    const internal = sim as unknown as Internals;
    const holder = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
    const challenger = sim.players.find((p) => p.side === "away" && p.pos === "DF")!;
    for (const p of sim.players) {
      p.x = -30;
      p.z = 25;
    }
    holder.x = 40;
    holder.z = 0;
    holder.vx = velocity;
    holder.vz = 0;
    challenger.x = behind ? 38.3 : 42.1;
    challenger.z = 0;
    sim.ball.x = 40.9;
    sim.ball.z = 0;
    sim.ball.holder = holder.id;
    internal.restartTimer = 0;
    // Successful standing challenge and foul, followed by an ordinary nonviolent sanction roll.
    const draws = [0, 0.9, 0, 0.8, 0.9];
    internal.rnd = () => draws.shift() ?? 0.8;
    return { sim, internal, holder, challenger };
  };

  it("cannot award a ball-challenge penalty from behind outside ball reach", () => {
    const { sim, internal, holder, challenger } = challenge(true, 5);
    internal.pressure(holder, MATCH_SIMULATION_STEP);
    expect(challenger.tackles).toBe(0);
    expect(sim.stats.away.fouls).toBe(0);
    expect(internal.setPiece).toBeNull();
    expect(sim.ball.holder).toBe(holder.id);
    sim.dispose();
  });

  it("retains an actual reachable penalty foul", () => {
    const { sim, internal, holder } = challenge(false, 5);
    internal.pressure(holder, MATCH_SIMULATION_STEP);
    expect(sim.stats.away.fouls).toBe(1);
    expect(internal.setPiece?.kind).toBe("penalty");
    expect(sim.stats.away.yellow).toBe(1);
    sim.dispose();
  });

  it("does not call a retreating carrier's foul a denied obvious goal chance", () => {
    const { sim, internal, holder } = challenge(false, -5);
    internal.pressure(holder, MATCH_SIMULATION_STEP);
    expect(sim.stats.away.fouls).toBe(1);
    expect(internal.setPiece?.kind).toBe("penalty");
    expect(sim.stats.away.yellow).toBe(0);
    sim.dispose();
  });
});
