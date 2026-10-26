import { describe, expect, it } from "vitest";
import { MatchSim } from "./sim";
import { FIELD_X, GOAL_H, GOAL_Z, type WeatherKind } from "./sim-rules";
import {
  BALL_PHYSICS_RADIUS,
  createRapierBallAuthority,
  type BallPhysicsAuthority,
  type RapierBallState,
} from "./rapier-ball-authority";
import { buildTeamSetup } from "./quickMatch";
import { FREE_KICK_FLIGHT_CANDIDATES } from "./free-kick-flight";
import { BALL_FLIGHT_PREDICTION_TICKS } from "./ball-flight-prediction";
import type { Side, SimPlayer } from "./sim-types";

type Internal = {
  setupDirectFK(side: Side, x: number, z: number): void;
  takeDirectFK(): void;
  setPiece: { takerId: string } | null;
  pendingShot: { side: Side; shooter: string; outcome: string; targetZ: number } | null;
  pass: { from: string; to: string } | null;
  ballVy: number;
  ballSpin: number;
  ballPhysics: BallPhysicsAuthority;
  rnd: () => number;
};
const from = { x: 27.628748957757036, z: 8.379648913343846 };
const original = {
  vx: 26.33528016338269,
  vz: -6.33616318377741,
  vy: 5.121723178859725,
  spin: 1.1076863268390298,
  targetZ: 2.395725286533125,
};
const originalPower = Math.hypot(original.vx, original.vz);
const originalDistance = Math.hypot(FIELD_X - from.x, original.targetZ - from.z);
const originalFlight = originalDistance / originalPower;
const originalTargetH = 0.25 + original.vy * originalFlight - 4.905 * originalFlight ** 2;

function useRecordedDraws(internal: Internal) {
  const values = [
    0,
    original.targetZ / (GOAL_Z * 1.5) + 0.5,
    0.5,
    0.5,
    (originalTargetH - 0.3) / 1.7,
    (originalPower - 21) / 7,
    original.spin / 6 + 0.5,
  ];
  let draws = 0;
  internal.rnd = () => {
    expect(draws).toBeLessThan(values.length);
    return values[draws++]!;
  };
  return () => draws;
}
async function stage(side: Side, weather: WeatherKind, x = from.x) {
  const sim = new MatchSim(
    buildTeamSetup("arm_137896"),
    buildTeamSetup("arm_137898"),
    "catalog-realism-20261020-v1-011-arm-matched-strength",
    { weather },
  );
  const internal = sim as unknown as Internal;
  const dir = side === "home" ? 1 : -1;
  for (const player of sim.players) {
    player.x = -dir * 30;
    player.z = 25;
    player.vx = player.vz = 0;
  }
  for (const player of sim.players.filter((p) => p.side !== side && p.pos !== "GK").slice(0, 4)) {
    player.x = dir * (x + 9.15);
    player.z = from.z;
  }
  sim.setBallPhysicsAuthority(await createRapierBallAuthority());
  internal.setupDirectFK(side, dir * x, from.z);
  return { sim, internal, dir };
}
async function trace(internal: Internal, sim: MatchSim, dir: number, players: SimPlayer[]) {
  const probe = await createRapierBallAuthority();
  const state: RapierBallState = { ...sim.ball, vy: internal.ballVy, spin: internal.ballSpin };
  let wallContacts = 0;
  let crossing: { z: number; height: number } | null = null;
  try {
    probe.restore!(internal.ballPhysics.checkpoint!());
    for (let tick = 0; tick < 120; tick++) {
      const previous = { ...state };
      probe.step(1 / 30, state, null);
      wallContacts += players.filter(
        (p) =>
          Math.hypot(p.x - state.x, p.z - state.z) < 1.9 + BALL_PHYSICS_RADIUS &&
          state.height - BALL_PHYSICS_RADIUS < 2.4,
      ).length;
      const plane = dir * (FIELD_X + BALL_PHYSICS_RADIUS);
      if (previous.x * dir < plane * dir && state.x * dir >= plane * dir) {
        const ratio = (plane - previous.x) / (state.x - previous.x);
        crossing = {
          z: previous.z + (state.z - previous.z) * ratio,
          height: previous.height + (state.height - previous.height) * ratio,
        };
        break;
      }
    }
  } finally {
    probe.dispose();
  }
  return { wallContacts, crossing };
}

describe("direct free-kick trajectory planning", () => {
  it.each<readonly [Side, WeatherKind]>([
    ["home", "clear"],
    ["home", "rain"],
    ["home", "heat"],
    ["away", "clear"],
    ["away", "rain"],
    ["away", "heat"],
  ])("clears the staged wall and descends inside the %s goal in %s", async (side, weather) => {
    const { sim, internal, dir } = await stage(side, weather);
    try {
      const taker = internal.setPiece!.takerId;
      const wall = sim.players
        .filter(
          (p) =>
            p.side !== side &&
            p.pos !== "GK" &&
            Math.hypot(p.x - sim.ball.x, p.z - sim.ball.z) < 12,
        )
        .map((p) => ({ ...p }));
      const draws = useRecordedDraws(internal);
      internal.takeDirectFK();
      expect(draws()).toBe(7);
      expect(internal.pendingShot).toMatchObject({ shooter: taker, outcome: "goal" });
      expect(sim.stats[side].shots).toBe(1);
      expect(sim.stats[side].goals).toBe(0);
      expect(Math.hypot(sim.ball.vx, sim.ball.vz, internal.ballVy)).toBeLessThanOrEqual(
        Math.hypot(originalPower, original.vy),
      );
      const flight = await trace(internal, sim, dir, wall);
      expect(flight.wallContacts).toBe(0);
      expect(flight.crossing).not.toBeNull();
      expect(Math.abs(flight.crossing!.z) + BALL_PHYSICS_RADIUS).toBeLessThan(GOAL_Z);
      expect(flight.crossing!.height + BALL_PHYSICS_RADIUS).toBeLessThan(GOAL_H);
      expect(flight.crossing!.height).toBeGreaterThanOrEqual(BALL_PHYSICS_RADIUS);
      expect(sim.stats[side].goals).toBe(0);
    } finally {
      sim.dispose();
    }
  });
  it("plays a named teammate when the target is obstructed without a viable arc", async () => {
    const { sim, internal } = await stage("home", "clear", FIELD_X - 11.5);
    try {
      const taker = internal.setPiece!.takerId;
      const receiver = sim.players.find(
        (p) => p.side === "home" && p.id !== taker && p.pos !== "GK",
      )!;
      receiver.x = sim.ball.x - 5;
      receiver.z = sim.ball.z - 3;
      const obstacle = sim.players.find((p) => p.side === "away" && p.pos !== "GK")!;
      obstacle.x = FIELD_X;
      obstacle.z = original.targetZ;
      const create = internal.ballPhysics.createFlightProbe!.bind(internal.ballPhysics);
      let probes = 0,
        samples = 0,
        states = 0,
        disposals = 0;
      internal.ballPhysics.createFlightProbe = () => {
        probes++;
        const probe = create();
        return {
          sample: (initial) => {
            samples++;
            const result = probe.sample(initial);
            states += result.length;
            return result;
          },
          dispose: () => {
            disposals++;
            probe.dispose();
          },
        };
      };
      useRecordedDraws(internal);
      internal.takeDirectFK();
      expect(internal.pendingShot).toBeNull();
      expect(sim.stats.home.shots).toBe(0);
      expect(sim.stats.home.passes).toBe(1);
      expect(internal.pass).toMatchObject({ from: taker, to: receiver.id });
      expect(sim.ball.holder).toBeNull();
      expect(Math.hypot(sim.ball.vx, sim.ball.vz)).toBeGreaterThan(0);
      expect(sim.stats.home.goals).toBe(0);
      expect(probes).toBe(1);
      expect(samples).toBeGreaterThan(0);
      expect(samples).toBeLessThanOrEqual(FREE_KICK_FLIGHT_CANDIDATES);
      expect(states).toBeLessThanOrEqual(
        FREE_KICK_FLIGHT_CANDIDATES * (BALL_FLIGHT_PREDICTION_TICKS + 1),
      );
      expect(disposals).toBe(1);
    } finally {
      sim.dispose();
    }
  });
  it("resumes the planned flight in a new authority with exact state and continued progress", async () => {
    const { sim, internal } = await stage("home", "heat");
    const resumed = new MatchSim(
      buildTeamSetup("arm_137896"),
      buildTeamSetup("arm_137898"),
      "catalog-realism-20261020-v1-011-arm-matched-strength",
      { weather: "heat" },
    );
    try {
      const matchRng = internal.rnd;
      useRecordedDraws(internal);
      internal.takeDirectFK();
      internal.rnd = matchRng;
      const launch = { ...sim.ball };
      const startedAt = sim.time;
      const checkpoint = sim.checkpoint();
      const authority = await createRapierBallAuthority();
      resumed.setBallPhysicsAuthority(authority);
      resumed.restoreCheckpoint(checkpoint, authority);
      for (let tick = 0; tick < 120; tick++) {
        sim.step(1 / 30, 6, true);
        resumed.step(1 / 30, 6, true);
      }
      expect(resumed.checkpoint()).toEqual(sim.checkpoint());
      expect(sim.time).toBeGreaterThan(startedAt);
      expect(sim.ball).not.toEqual(launch);
    } finally {
      sim.dispose();
      resumed.dispose();
    }
  });
});
