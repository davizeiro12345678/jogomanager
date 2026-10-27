import { expect, it } from "vitest";
import { World } from "@dimforge/rapier3d-compat";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BALL_PHYSICS_RADIUS, createRapierBallAuthority } from "./rapier-ball-authority";

const cases = [14, 28, 40, 55, 70].flatMap((speed) =>
  [-1, 1].flatMap((end) => [-1, 1].map((post) => ({ speed, end, post }))),
);
it.each(cases)(
  "rebounds at $speed m/s on goal $end post $post without tunnelling",
  async ({ speed, end, post }) => {
    let contacts = 0;
    const physics = await createRapierBallAuthority({
      observeSubstep: (_ms, count) => {
        contacts += count;
      },
    });
    const ball = {
      x: end * 49.95,
      z: post * 3.66,
      height: 1.22,
      vx: end * speed,
      vy: 0,
      vz: 0,
      spin: 0,
      holder: null,
    };
    const samples: {
      tick: number;
      x: number;
      z: number;
      height: number;
      vx: number;
      vy: number;
      vz: number;
      spin: number;
    }[] = [];
    let rebound = false;
    try {
      for (let tick = 0; tick < 45; tick++) {
        physics.step(1 / 30, ball, null);
        rebound ||= ball.vx * end < -0.2;
        expect(
          Object.values(ball)
            .filter((value) => typeof value === "number")
            .every(Number.isFinite),
        ).toBe(true);
        expect(ball.height).toBeGreaterThanOrEqual(BALL_PHYSICS_RADIUS - 0.001);
        // The front of the real upright lies at x=50.9; it cannot be crossed
        // before the impact has reversed the incoming normal velocity.
        if (!rebound) expect(ball.x * end).toBeLessThanOrEqual(50.9);
        samples.push({
          tick,
          x: ball.x,
          z: ball.z,
          height: ball.height,
          vx: ball.vx,
          vy: ball.vy,
          vz: ball.vz,
          spin: ball.spin,
        });
      }
      expect(rebound).toBe(true);
      expect(contacts).toBeGreaterThan(0);
      const output = process.env["MATCH3D_PHYSICS_EVIDENCE"];
      if (output) {
        mkdirSync(output, { recursive: true });
        writeFileSync(
          path.join(output, `post-${speed}-${end}-${post}.json`),
          JSON.stringify({ speed, end, post, dt: 1 / 30, contacts, samples }, null, 2) + "\n",
        );
      }
    } finally {
      physics.dispose();
    }
  },
);

it("checks real solver floor penetration rather than only the clamped presentation height", async () => {
  const physics = await createRapierBallAuthority();
  const ball = { x: 0, z: 0, height: 3.4, vx: 1, vy: 0, vz: 0, spin: 0, holder: null };
  try {
    for (let tick = 0; tick < 600; tick++) physics.step(1 / 60, ball, null);
    const checkpoint = physics.checkpoint!(),
      snapshot = World.restoreSnapshot(checkpoint.world);
    try {
      const y = snapshot.getRigidBody(checkpoint.body).translation().y;
      expect(BALL_PHYSICS_RADIUS - y).toBeLessThanOrEqual(0.005);
    } finally {
      snapshot.free();
    }
  } finally {
    physics.dispose();
  }
});
