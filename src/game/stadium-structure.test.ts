import { describe, expect, it } from "vitest";
import {
  stadiumRoofStructure,
  stadiumAisleCenters,
  stadiumSeatFront,
  STADIUM_AISLE_WIDTH,
} from "./stadium-structure";

describe("stadium structure", () => {
  it("anchors roof steel to the ground and keeps a bounded single geometry", () => {
    for (const rings of [4, 8, 12]) {
      const geometry = stadiumRoofStructure(rings, 52.5, 34);
      const positions = geometry.getAttribute("position");
      for (const value of positions.array) expect(Number.isFinite(value)).toBe(true);
      expect(geometry.groups).toHaveLength(0);
      expect(geometry.getIndex()!.count / 3).toBeLessThanOrEqual(2700);
      expect(geometry.boundingBox!.min.y).toBeCloseTo(0, 5);
      expect(geometry.boundingBox!.max.y).toBeLessThan(2 + rings * 1.45 + 7);
      geometry.dispose();
    }
  });

  it("cuts chair panels out of the same aisles used by stairs and spectators", () => {
    const width = 135;
    const centers = stadiumAisleCenters(52.5);
    const geometry = stadiumSeatFront(width, 1.2, centers);
    const position = geometry.getAttribute("position"),
      uv = geometry.getAttribute("uv");
    const indices = geometry.getIndex()!;
    for (let i = 0; i < indices.count; i += 3) {
      const xs = [0, 1, 2].map((v) => position.getX(indices.getX(i + v)));
      for (const center of centers) {
        // No triangle crosses an open stair corridor.
        expect(
          Math.min(...xs) >= center + STADIUM_AISLE_WIDTH / 2 - 1e-5 ||
            Math.max(...xs) <= center - STADIUM_AISLE_WIDTH / 2 + 1e-5,
        ).toBe(true);
      }
    }
    for (let i = 0; i < position.count; i++)
      expect(uv.getX(i)).toBeCloseTo((position.getX(i) + width / 2) / width, 5);
    expect(indices.count / 3).toBe(12);
    geometry.dispose();
  });
});
