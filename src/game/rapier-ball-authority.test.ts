import { describe, expect, it, vi } from "vitest";

import { BALL_PHYSICS_RADIUS, createRapierBallAuthority } from "./rapier-ball-authority";

describe("RapierBallAuthority", () => {
  it("avoids per-substep velocity reads for a straight flight without skipping solver work", async () => {
    let observations = 0;
    const physics = await createRapierBallAuthority({ observeSubstep: () => observations++ });
    const state = { x: 0, z: 0, height: 2, vx: 5, vy: 2, vz: 1, spin: 0, holder: null };
    physics.reset(state);
    const body = (physics as unknown as { ballBody: { linvel(): unknown } }).ballBody;
    const read = vi.spyOn(body, "linvel");
    try {
      physics.step(1 / 30, state, null);
      expect(observations).toBe(5);
      expect(read).toHaveBeenCalledTimes(1); // final canonical write, no Magnus reads
      expect(state.x).toBeGreaterThan(0);
      expect(state.height).toBeLessThan(2 + 2 / 30);
    } finally {
      read.mockRestore();
      physics.dispose();
    }
  });

  it("leaves canonical state, checkpoint and solver observations untouched for invalid elapsed time", async () => {
    let observations = 0;
    const physics = await createRapierBallAuthority({ observeSubstep: () => observations++ });
    const initial = {
      x: 0,
      z: 0,
      height: 2,
      vx: 5,
      vy: 2,
      vz: 0,
      spin: 3,
      holder: null as string | null,
    };
    physics.reset(initial);
    const checkpoint = physics.checkpoint!();
    try {
      for (const dt of [0, -1, NaN, Infinity, -Infinity]) {
        // Both rule injection and attachment would mutate the world before
        // integration unless the public entry point validates elapsed time.
        for (const held of [false, true]) {
          const state = { ...initial, x: 12, holder: held ? "home-9" : null };
          const before = { ...state };
          physics.step(dt, state, held ? { id: "home-9", x: 20, z: 8, vx: 2, vz: 0 } : null);
          expect(state).toEqual(before);
          expect(physics.checkpoint!()).toEqual(checkpoint);
          expect(observations).toBe(0);
        }
      }
      physics.step(1 / 60, initial, null);
      expect(initial.x).toBeGreaterThan(0);
      expect(observations).toBeGreaterThan(0);
    } finally {
      physics.dispose();
    }
  });

  it("keeps the positive-step trajectory identical when invalid calls are interleaved", async () => {
    const plain = await createRapierBallAuthority(),
      paused = await createRapierBallAuthority();
    const a = {
        x: 0,
        z: 0,
        height: 2,
        vx: 5,
        vy: 2,
        vz: 1,
        spin: 3,
        holder: null as string | null,
      },
      b = { ...a };
    try {
      plain.reset(a);
      paused.reset(b);
      for (const dt of [1 / 600, 1 / 240, 1 / 139, 1 / 60, 1 / 30, 0.4, 0.5]) {
        for (const invalid of [0, -1, NaN, Infinity, -Infinity]) paused.step(invalid, b, null);
        plain.step(dt, a, null);
        paused.step(dt, b, null);
        expect(b).toEqual(a);
        expect(paused.checkpoint!()).toEqual(plain.checkpoint!());
      }
    } finally {
      plain.dispose();
      paused.dispose();
    }
  });

  it("writes Rapier gravity and pitch contact back to canonical ball state", async () => {
    const physics = await createRapierBallAuthority({ fieldX: 52.5, fieldZ: 34 });
    const ball = {
      x: 0,
      z: 0,
      height: 3.4,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      holder: null as string | null,
    };

    try {
      for (let tick = 0; tick < 600; tick += 1) physics.step(1 / 60, ball, null);

      expect(ball.height).toBeGreaterThanOrEqual(BALL_PHYSICS_RADIUS - 0.001);
      expect(ball.height).toBeLessThan(0.3);
    } finally {
      physics.dispose();
    }
  });

  it("uses a kinematic Rapier target while a player holds the ball", async () => {
    const physics = await createRapierBallAuthority({ fieldX: 52.5, fieldZ: 34 });
    const ball = {
      x: 0,
      z: 0,
      height: BALL_PHYSICS_RADIUS,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      holder: "home-9" as string | null,
    };
    const holder = { id: "home-9", x: 4, z: -2, vx: 3, vz: 0 };

    try {
      physics.step(1 / 30, ball, holder);

      expect(ball.x).toBeGreaterThan(holder.x + 0.65);
      expect(ball.height).toBeCloseTo(BALL_PHYSICS_RADIUS, 3);
    } finally {
      physics.dispose();
    }
  });

  it("writes a Rapier post rebound back to the canonical velocity", async () => {
    const physics = await createRapierBallAuthority({ fieldX: 52.5, fieldZ: 34 });
    const ball = {
      x: 49.95,
      z: 3.66,
      height: 1.22,
      vx: 14,
      vy: 0,
      vz: 0,
      spin: 0,
      holder: null as string | null,
    };

    try {
      let reversedAfterPost = false;
      for (let tick = 0; tick < 30; tick += 1) {
        physics.step(1 / 120, ball, null);
        reversedAfterPost ||= ball.vx < -0.2;
      }

      expect(reversedAfterPost).toBe(true);
    } finally {
      physics.dispose();
    }
  });
});
