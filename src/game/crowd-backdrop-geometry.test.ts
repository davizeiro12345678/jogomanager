import { expect, it } from "vitest";
import { crowdBackdropRing } from "./crowd-backdrop-geometry";

it.each([3, 5])(
  "preserves four raked panels, UV density and eight triangles in one %s-ring surface",
  (rings) => {
    const geometry = crowdBackdropRing(rings);
    try {
      expect(geometry.groups).toHaveLength(0);
      expect(geometry.getAttribute("position").count).toBe(16);
      expect(geometry.index!.count).toBe(24);
      const bounds = geometry.boundingBox!;
      expect(bounds.min.y).toBeCloseTo(3.2, 5);
      expect(bounds.max.y).toBeCloseTo(12.2, 5);
      expect(bounds.max.x).toBeCloseTo(62 + rings * 1.5, 5);
      expect(bounds.min.x).toBeCloseTo(-bounds.max.x, 5);
      expect(bounds.max.z).toBeCloseTo(40.5 + rings * 1.5, 5);
      expect(bounds.min.z).toBeCloseTo(-bounds.max.z, 5);
      const uv = geometry.getAttribute("uv");
      expect(Math.max(...Array.from({ length: 8 }, (_, i) => uv.getX(i)))).toBe(4);
      expect(Math.max(...Array.from({ length: 8 }, (_, i) => uv.getX(i + 8)))).toBe(3);
    } finally {
      geometry.dispose();
    }
  },
);
