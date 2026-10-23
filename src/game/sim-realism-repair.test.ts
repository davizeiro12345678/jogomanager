import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { FIELD_X, MATCH_SIMULATION_STEP, MatchSim } from "./sim";
import { createRapierBallAuthority, BALL_PHYSICS_RADIUS } from "./rapier-ball-authority";
import type { Side } from "./sim-types";

type Internals = {
  rnd: () => number;
  setupDirectFK(side: Side, x: number, z: number): void;
  takeDirectFK(): void;
  setPiece: { takerId: string } | null;
  pendingShot: unknown;
  ballVy: number;
  ballSpin: number;
  controlBall(player: import("./sim-types").SimPlayer, speed: number, height: number): void;
  moveBall(dt: number, physics: boolean): void;
  resolveShot(previous: { x: number; z: number; height: number }): boolean;
};
const create = () => new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "realism-contact");

describe("free-kick run-up and legal space", () => {
  it.each<Side>(["home", "away"])(
    "clears the fouled %s teammate from another taker's launch",
    (side) => {
      const sim = create();
      const internal = sim as unknown as Internals;
      const dir = side === "home" ? 1 : -1;
      const fouled = sim.players.find((p) => p.side === side && p.pos === "MF")!;
      for (const p of sim.players) {
        p.x = -dir * 35;
        p.z = 25;
      }
      fouled.shooting = 1;
      fouled.x = dir * 25;
      fouled.z = 4;
      sim.ball.holder = fouled.id;
      internal.rnd = () => 0;
      internal.setupDirectFK(side, fouled.x, fouled.z);
      expect(internal.setPiece!.takerId).not.toBe(fouled.id);
      internal.takeDirectFK();
      internal.moveBall(MATCH_SIMULATION_STEP, false);
      expect(sim.ball.holder).toBeNull();
      expect(internal.pendingShot).not.toBeNull();
      expect(sim.ball.x * dir).toBeGreaterThan(25);
      sim.dispose();
    },
  );

  it("keeps non-wall defenders at the required free-kick distance", () => {
    const sim = create();
    const internal = sim as unknown as Internals;
    for (const p of sim.players) {
      p.x = 25;
      p.z = 4;
    }
    internal.setupDirectFK("home", 25, 4);
    for (const p of sim.players.filter((p) => p.side === "away" && p.pos !== "GK"))
      expect.soft(Math.hypot(p.x - 25, p.z - 4)).toBeGreaterThanOrEqual(9.15 - 1e-9);
    sim.dispose();
  });
});

describe("one physical goal line", () => {
  it("closes a shot when an actual failed first touch changes its flight", () => {
    const sim = create();
    const internal = sim as unknown as Internals;
    internal.setupDirectFK("home", 25, 0);
    internal.rnd = () => 0;
    internal.takeDirectFK();
    const teammate = sim.players.find(
      (p) => p.side === "home" && p.id !== internal.setPiece?.takerId,
    )!;
    internal.rnd = () => 0.999;
    internal.controlBall(teammate, 25, 1);
    expect(sim.ball.holder).toBeNull();
    expect(internal.pendingShot).toBeNull();
    expect(sim.stats.home.shots).toBe(1);
    expect(sim.shotMap).toHaveLength(1);
    expect(sim.ball.vx).not.toBe(0);
    sim.dispose();
  });

  it("records a physical post rebound once before the ball crosses the goal line", async () => {
    const sim = create();
    const internal = sim as unknown as Internals;
    internal.setupDirectFK("home", 25, 0);
    internal.rnd = () => 0;
    internal.takeDirectFK();
    for (const p of sim.players) {
      p.x = -30;
      p.z = 25;
    }
    sim.ball.x = FIELD_X - 0.7;
    sim.ball.z = 3.66;
    sim.ball.height = 1.22;
    sim.ball.vx = 14;
    sim.ball.vz = 0;
    internal.ballVy = internal.ballSpin = 0;
    sim.setBallPhysicsAuthority(await createRapierBallAuthority());
    for (let tick = 0; tick < 20; tick++) internal.moveBall(1 / 120, true);
    expect(sim.events.filter((event) => event.type === "post")).toHaveLength(1);
    expect(internal.pendingShot).toBeNull();
    expect(sim.stats.home.goals).toBe(0);
    expect(sim.ball.vx).toBeLessThan(0);
    sim.dispose();
  });
  it.each<Side>(["home", "away"])("waits for the whole ball at the %s goal", (side) => {
    const sim = create();
    const internal = sim as unknown as Internals;
    const dir = side === "home" ? 1 : -1;
    internal.setupDirectFK(side, dir * 25, 0);
    internal.rnd = () => 0;
    internal.takeDirectFK();
    sim.ball.x = dir * (FIELD_X + BALL_PHYSICS_RADIUS / 2);
    sim.ball.z = 0;
    sim.ball.height = 1;
    expect(internal.resolveShot({ x: dir * 52.3, z: 0, height: 1 })).toBe(false);
    expect(sim.stats[side].goals).toBe(0);
    sim.ball.x = dir * (FIELD_X + BALL_PHYSICS_RADIUS + 0.05);
    expect(internal.resolveShot({ x: dir * (FIELD_X + 0.06), z: 0, height: 1 })).toBe(true);
    expect(sim.stats[side].goals).toBe(1);
    sim.dispose();
  });

  it("allows a shot to travel from the old inset to the actual goal line", () => {
    const sim = create();
    const internal = sim as unknown as Internals;
    internal.setupDirectFK("home", 25, 0);
    internal.rnd = () => 0;
    internal.takeDirectFK();
    for (const p of sim.players) {
      p.x = -30;
      p.z = 25;
    }
    sim.ball.x = FIELD_X - 0.7;
    sim.ball.z = 0;
    sim.ball.height = 1;
    sim.ball.vx = 10;
    sim.ball.vz = 0;
    internal.moveBall(MATCH_SIMULATION_STEP, false);
    expect(sim.stats.home.goals).toBe(0);
    expect(internal.pendingShot).not.toBeNull();
    expect(sim.ball.x).toBeGreaterThan(FIELD_X - 0.5);
    sim.dispose();
  });

  it.each([-1, 1])("places the Rapier post at the canonical line in direction %s", async (dir) => {
    const physics = await createRapierBallAuthority();
    const ball = {
      x: dir * (FIELD_X - 0.7),
      z: 3.66,
      height: 1.22,
      vx: dir * 14,
      vy: 0,
      vz: 0,
      spin: 0,
      holder: null,
    };
    try {
      let reversed = false;
      for (let tick = 0; tick < 20; tick++) {
        physics.step(1 / 120, ball, null);
        if (ball.vx * dir < -0.2) {
          expect(ball.x * dir).toBeGreaterThan(FIELD_X - 0.35);
          reversed = true;
          break;
        }
      }
      expect(reversed).toBe(true);
    } finally {
      physics.dispose();
    }
  });
});
