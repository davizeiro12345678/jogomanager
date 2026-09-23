import { describe, expect, it } from "vitest";

import { BALL_PHYSICS_RADIUS, createRapierVisualPhysics } from "./rapier-ball-visual";
import type { CanonicalBallPhysicsState, VisualBallState } from "./visual-ball";

function canonical(overrides: Partial<CanonicalBallPhysicsState> = {}): CanonicalBallPhysicsState {
  return {
    x: 0,
    z: 0,
    height: BALL_PHYSICS_RADIUS,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    attached: false,
    holder: null,
    ...overrides,
  };
}

function frozenCanonical(overrides: Partial<CanonicalBallPhysicsState> = {}) {
  return Object.freeze(canonical(overrides)) as CanonicalBallPhysicsState;
}

function expectSameVisualBall(actual: VisualBallState, expected: VisualBallState, precision = 9) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
  expect(actual.height).toBeCloseTo(expected.height, precision);
  expect(actual.vx).toBeCloseTo(expected.vx, precision);
  expect(actual.vy).toBeCloseTo(expected.vy, precision);
  expect(actual.vz).toBeCloseTo(expected.vz, precision);
  expect(actual.spin).toBeCloseTo(expected.spin, precision);
}

describe("Rapier visual ball physics", () => {
  it("initializes asynchronously and exposes a visual-only engine", async () => {
    const physics = await createRapierVisualPhysics();
    const attached = frozenCanonical({
      x: 12.5,
      z: -4.25,
      height: 0.34,
      vx: 4,
      spin: 1.8,
      attached: true,
      holder: "home-9",
    });

    try {
      expect(physics.engine).toBe("rapier-wasm-visual");
      physics.reset(attached);

      expect(physics.read(attached)).toEqual({
        x: attached.x,
        z: attached.z,
        height: attached.height,
        vx: attached.vx,
        vy: attached.vy,
        vz: attached.vz,
        spin: attached.spin,
      });
    } finally {
      physics.dispose();
    }
  });

  it("is deterministic for the same fixed-step visual input", async () => {
    const first = await createRapierVisualPhysics();
    const second = await createRapierVisualPhysics();
    const launch = frozenCanonical({
      x: -18,
      z: -9,
      height: 1.4,
      vx: 8.5,
      vy: 3.1,
      vz: 2.25,
      spin: 3.4,
    });

    try {
      first.reset(launch);
      second.reset(launch);
      for (let tick = 0; tick < 48; tick += 1) {
        first.step(1 / 60);
        second.step(1 / 60);
      }

      expectSameVisualBall(first.read(launch), second.read(launch));
    } finally {
      first.dispose();
      second.dispose();
    }
  });

  it("does not mutate frozen canonical snapshots while synchronizing attachment and release", async () => {
    const physics = await createRapierVisualPhysics();
    const held = frozenCanonical({
      x: -7.2,
      z: 2.8,
      height: 0.22,
      vx: 2,
      vz: -1,
      spin: 0.5,
      attached: true,
      holder: "away-10",
    });
    const released = frozenCanonical({
      x: -6.85,
      z: 2.62,
      height: 0.72,
      vx: 9.5,
      vy: 2.6,
      vz: -2.2,
      spin: 5.5,
      attached: false,
      holder: null,
    });
    const reattached = frozenCanonical({
      x: -5.4,
      z: 2.1,
      height: 0.2,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      attached: true,
      holder: "home-4",
    });
    const heldBefore = { ...held };
    const releasedBefore = { ...released };
    const reattachedBefore = { ...reattached };

    try {
      physics.reset(held);
      expect(physics.read(held)).toMatchObject({ x: held.x, z: held.z, height: held.height });

      physics.synchronize(held, released);
      // The first free-frame step is deliberately skipped: MatchSim already
      // integrated the release, so visual physics must never double-integrate it.
      physics.step(1 / 60);
      // Rapier stores numbers as f32, so compare the pose at an appropriate
      // precision while still proving that the skipped frame did not move it.
      expectSameVisualBall(physics.read(released), released, 5);

      physics.step(1 / 60);
      const airborneVisual = physics.read(released);
      expect(airborneVisual.x).toBeGreaterThan(released.x);
      expect(airborneVisual.height).toBeGreaterThan(released.height);

      physics.synchronize(released, reattached);
      expect(physics.read(reattached)).toEqual({
        x: reattached.x,
        z: reattached.z,
        height: reattached.height,
        vx: reattached.vx,
        vy: reattached.vy,
        vz: reattached.vz,
        spin: reattached.spin,
      });

      expect(held).toEqual(heldBefore);
      expect(released).toEqual(releasedBefore);
      expect(reattached).toEqual(reattachedBefore);
    } finally {
      physics.dispose();
    }
  });

  it("renders a post rebound without changing the canonical ball or football rules", async () => {
    const physics = await createRapierVisualPhysics();
    const incoming = frozenCanonical({
      x: 51.55,
      z: 3.66,
      height: 1.22,
      vx: 14,
      vy: 0,
      vz: 0,
      attached: false,
      holder: null,
    });
    const incomingBefore = { ...incoming };
    let fallback = canonical(incoming);
    let reversedAfterPost = false;

    try {
      physics.reset(incoming);
      for (let tick = 0; tick < 30; tick += 1) {
        physics.step(1 / 120);
        // The renderer receives the visual pose and a separate canonical
        // fallback. Advancing this fallback mimics a rule engine that does
        // not know about the cosmetic post collision.
        fallback = canonical({
          ...fallback,
          x: fallback.x + fallback.vx / 120,
          z: fallback.z + fallback.vz / 120,
        });
        const visual = physics.read(fallback);
        reversedAfterPost ||= visual.vx < -0.2;
      }

      expect(reversedAfterPost).toBe(true);
      expect(incoming).toEqual(incomingBefore);

      // A later canonical restart wins immediately. This is the boundary that
      // keeps score, possession, replay and MatchSim outside Rapier's authority.
      const ruleRestart = frozenCanonical({
        x: -12,
        z: 5,
        height: 0.2,
        attached: true,
        holder: "home-8",
      });
      const ruleRestartBefore = { ...ruleRestart };
      physics.synchronize(fallback, ruleRestart);
      expect(physics.read(ruleRestart)).toEqual({
        x: ruleRestart.x,
        z: ruleRestart.z,
        height: ruleRestart.height,
        vx: ruleRestart.vx,
        vy: ruleRestart.vy,
        vz: ruleRestart.vz,
        spin: ruleRestart.spin,
      });
      expect(ruleRestart).toEqual(ruleRestartBefore);
    } finally {
      physics.dispose();
    }
  });
});
