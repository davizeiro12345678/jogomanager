import { describe, expect, it } from "vitest";

import { BALL_PHYSICS_RADIUS, createRapierBallAuthority } from "./rapier-ball-authority";

describe("RapierBallAuthority", () => {
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
