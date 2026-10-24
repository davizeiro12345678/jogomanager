import { describe, expect, it } from "vitest";
import { createRapierBallAuthority } from "./rapier-ball-authority";

const airborne = (spin = 0) => ({
  x: 0,
  z: 0,
  height: 3,
  vx: 10,
  vy: 0,
  vz: 0,
  spin,
  holder: null,
});

describe("canonical aerodynamic acceleration units", () => {
  it("integrates 2 m/s² of wind as approximately 0.4 m/s over 0.2 seconds", async () => {
    const calm = await createRapierBallAuthority();
    const windy = await createRapierBallAuthority();
    const control = airborne(),
      ball = airborne();
    windy.setCondition("clear", { x: 2, z: 0 });
    try {
      for (let tick = 0; tick < 24; tick++) {
        calm.step(1 / 120, control, null);
        windy.step(1 / 120, ball, null);
      }
      expect(ball.vx - control.vx).toBeGreaterThan(0.37);
      expect(ball.vx - control.vx).toBeLessThan(0.41);
      expect(ball.height).toBeGreaterThan(2);
    } finally {
      calm.dispose();
      windy.dispose();
    }
  });

  it("integrates spin 3 as transverse acceleration without multiplying it by a mass mismatch", async () => {
    const calm = await createRapierBallAuthority();
    const curved = await createRapierBallAuthority();
    const control = airborne(),
      ball = airborne(3);
    try {
      for (let tick = 0; tick < 24; tick++) {
        calm.step(1 / 120, control, null);
        curved.step(1 / 120, ball, null);
      }
      expect(ball.vz - control.vz).toBeGreaterThan(0.5);
      expect(ball.vz - control.vz).toBeLessThan(0.65);
      expect(ball.vx).toBeLessThan(control.vx);
    } finally {
      calm.dispose();
      curved.dispose();
    }
  });

  it("preserves elapsed time for positive solver calls smaller than 1/240 s", async () => {
    const ordinary = await createRapierBallAuthority();
    const fine = await createRapierBallAuthority();
    const a = airborne(),
      b = airborne();
    try {
      for (let tick = 0; tick < 24; tick++) ordinary.step(1 / 120, a, null);
      for (let tick = 0; tick < 120; tick++) fine.step(1 / 600, b, null);
      expect(b.x).toBeCloseTo(a.x, 2);
      expect(b.height).toBeCloseTo(a.height, 2);
      expect(b.vx).toBeCloseTo(a.vx, 2);
    } finally {
      ordinary.dispose();
      fine.dispose();
    }
  });
});
