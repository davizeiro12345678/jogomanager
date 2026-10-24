import { describe, expect, it } from "vitest";
import { cornerArcAngles, penaltyArcAngles, pitchBoxPath, PITCH_PAINT } from "./pitch-markings";

describe("regulation pitch arcs", () => {
  it("paints three box sides without repainting the goal line or changing regulation dimensions", () => {
    for (const side of [-1, 1]) {
      for (const kind of ["penalty", "goal"] as const) {
        const path = pitchBoxPath(side, 52.5, kind);
        const depth = kind === "penalty" ? 16.5 : 5.5;
        const halfWidth = kind === "penalty" ? 20.16 : 9.16;
        expect(path).toHaveLength(4);
        expect(path[0]).toEqual([side * 52.5, -halfWidth]);
        expect(path[3]).toEqual([side * 52.5, halfWidth]);
        expect(path[1]).toEqual([side * (52.5 - depth), -halfWidth]);
        expect(path[2]).toEqual([side * (52.5 - depth), halfWidth]);
        expect(
          path.slice(1).some((point, i) => point[0] === side * 52.5 && path[i]![0] === side * 52.5),
        ).toBe(false);
      }
    }
    expect(PITCH_PAINT.lineWidth).toBe(0.12);
  });
  it("places every penalty arc point outside its area and both endpoints on the area edge", () => {
    for (const side of [-1, 1]) {
      const [start, end] = penaltyArcAngles(side);
      for (let step = 0; step <= 32; step++) {
        const angle = start + ((end - start) * step) / 32;
        expect(side * (9.15 * Math.cos(angle))).toBeLessThanOrEqual(-5.5 + 1e-9);
      }
      expect(Math.abs(9.15 * Math.cos(start))).toBeCloseTo(5.5);
      expect(Math.abs(9.15 * Math.cos(end))).toBeCloseTo(5.5);
    }
  });
  it("keeps each corner quarter-circle inside both touchlines", () => {
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const [start, end] = cornerArcAngles(x, z);
        expect(end - start).toBeCloseTo(Math.PI / 2);
        for (let step = 0; step <= 16; step++) {
          const angle = start + ((end - start) * step) / 16;
          expect(x * Math.cos(angle)).toBeLessThanOrEqual(1e-9);
          expect(z * Math.sin(angle)).toBeLessThanOrEqual(1e-9);
        }
      }
  });
});
