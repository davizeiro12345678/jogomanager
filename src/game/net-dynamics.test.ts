import { describe, expect, it } from "vitest";
import { NetDynamics, rearNetImpact } from "./net-dynamics";
import { BallResponse } from "./ball-response";

describe("tied goal cloth", () => {
  it("responds more strongly to powerful shots and dissipates the impact", () => {
    const slow = new NetDynamics(28, 16),
      fast = new NetDynamics(28, 16);
    slow.impact(0.5, 0.5, 5);
    fast.impact(0.5, 0.5, 30);
    slow.step(1 / 30, 0, 0);
    fast.step(1 / 30, 0, 0);
    expect(Math.max(...fast.displacement)).toBeGreaterThan(Math.max(...slow.displacement) * 3);
    const peak = Math.max(...fast.displacement);
    for (let i = 0; i < 600; i++) fast.step(1 / 120, i / 120, 0);
    expect(Math.max(...fast.displacement.map(Math.abs))).toBeLessThan(peak * 0.03);
  });
  it("keeps ties fixed, even under repeated hard impacts and gusts", () => {
    const net = new NetDynamics(28, 16);
    for (let step = 0; step < 600; step++) {
      if (step % 30 === 0) net.impact(0.5, 0.6, 40);
      net.step(1 / 60, step / 60, 1);
      expect(net.displacement.every(Number.isFinite)).toBe(true);
    }
    for (let x = 0; x <= net.cols; x++) {
      expect(net.displacement[x]).toBe(0);
      expect(net.displacement[net.rows * (net.cols + 1) + x]).toBe(0);
    }
    for (let y = 0; y <= net.rows; y++) {
      expect(net.displacement[y * (net.cols + 1)]).toBe(0);
      expect(net.displacement[y * (net.cols + 1) + net.cols]).toBe(0);
    }
  });
  it("has the same impact propagation at 30 Hz and 120 Hz", () => {
    const a = new NetDynamics(18, 10),
      b = new NetDynamics(18, 10);
    a.impact(0.6, 0.4, 24);
    b.impact(0.6, 0.4, 24);
    for (let i = 0; i < 30; i++) a.step(1 / 30, 0, 0);
    for (let i = 0; i < 120; i++) b.step(1 / 120, 0, 0);
    expect(a.displacement).toEqual(b.displacement);
  });
  it("detects swept contact in both goals with mirrored UVs", () => {
    for (const side of [-1, 1]) {
      const before = { x: side * 53.5, z: 1, height: 1, vx: side * 30, vz: 0 };
      const ball = { ...before, x: side * 54.8 };
      const impact = rearNetImpact(before, ball, side, 52.5);
      expect(impact?.u).toBeCloseTo(0.5 - side / 7.32);
      expect(impact?.speed).toBeCloseTo(30);
      expect(rearNetImpact(ball, ball, side, 52.5)).toBeNull();
      expect(rearNetImpact(before, { ...ball, height: 5 }, side, 52.5)).toBeNull();
      expect(rearNetImpact(before, { ...ball, x: side * 70 }, side, 52.5)).toBeNull();
    }
  });
});

describe("football shell response", () => {
  it("stays spherical during motion without an impact", () => {
    const ball = new BallResponse();
    expect(ball.step(1 / 30)).toEqual({ axial: 1, radial: 1 });
  });
  it("briefly compresses with volume preserved and returns to rest", () => {
    const ball = new BallResponse();
    ball.impact(30);
    const compressed = ball.step(1 / 60);
    expect(compressed.axial).toBeLessThan(1);
    expect(compressed.axial).toBeGreaterThanOrEqual(0.915);
    expect(compressed.axial * compressed.radial ** 2).toBeCloseTo(1, 8);
    for (let i = 0; i < 120; i++) ball.step(1 / 60);
    expect(ball.compression).toBeLessThan(1e-6);
  });
});
