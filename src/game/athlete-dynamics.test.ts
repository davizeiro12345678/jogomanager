import { describe, expect, it } from "vitest";
import { advanceAthlete, athleteContact } from "./athlete-dynamics";

const body = (extra = {}) => ({
  x: 0,
  z: 0,
  vx: 0,
  vz: 0,
  pace: 80,
  physical: 80,
  stamina: 100,
  weightKg: 78,
  ...extra,
});
describe("athlete mechanics", () => {
  it("limits launch and reversal acceleration instead of snapping velocity", () => {
    const p = body();
    advanceAthlete(p, 20, 0, 7, 1 / 30, 1);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.vx).toBeLessThan(0.25);
    p.vx = 6;
    advanceAthlete(p, -20, 0, 7, 1 / 30, 1);
    expect(p.vx).toBeGreaterThan(5.6);
    expect(p.x).toBeGreaterThan(0);
  });
  it("integrates braking displacement and responds to traction and mass", () => {
    const p = body({ vx: 4 });
    advanceAthlete(p, 0.1, 0, 7, 0.1, 1);
    expect(p.x).toBeGreaterThan(0.25);
    expect(p.vx).toBeGreaterThan(2.8);
    const dry = body(),
      wet = body(),
      heavy = body({ weightKg: 100 });
    for (const [b, grip] of [
      [dry, 1],
      [wet, 0.65],
      [heavy, 1],
    ] as const)
      advanceAthlete(b, 20, 0, 7, 0.5, grip);
    expect(wet.vx).toBeLessThan(dry.vx);
    expect(heavy.vx).toBeLessThan(dry.vx);
  });
  it("keeps trajectories consistent at 30 and 120 steps per second", () => {
    const run = (fps: number) => {
      const p = body();
      for (let i = 0; i < fps * 3; i++) advanceAthlete(p, 9, 3, 6, 1 / fps, 1);
      return p;
    };
    const a = run(30),
      b = run(120);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.01);
    expect(Math.hypot(a.vx - b.vx, a.vz - b.vz)).toBeLessThan(0.01);
  });
  it("exchanges contact momentum by mass without adding kinetic energy", () => {
    const a = body({ vx: 4, vz: 1, weightKg: 90 });
    const b = body({ vx: -3, vz: -1, weightKg: 65 });
    const energy = () => 90 * (a.vx ** 2 + a.vz ** 2) + 65 * (b.vx ** 2 + b.vz ** 2);
    const initial = energy(),
      px = 90 * a.vx + 65 * b.vx,
      pz = 90 * a.vz + 65 * b.vz;
    athleteContact(a, b, 1, 0);
    expect(90 * a.vx + 65 * b.vx).toBeCloseTo(px, 8);
    expect(90 * a.vz + 65 * b.vz).toBeCloseTo(pz, 8);
    expect(energy()).toBeLessThan(initial);
    expect(b.vx - a.vx).toBeGreaterThanOrEqual(0);
    const separating = { ...a };
    athleteContact(a, b, 1, 0);
    expect(a).toEqual(separating);
  });
});
