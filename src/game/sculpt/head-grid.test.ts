import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { gridSurface } from "./head";

describe("owned sculpt surface buffers", () => {
  it("keeps 65535 out of the Uint16 primitive-restart index", () => {
    const point = new THREE.Vector3();
    const geometry = gridSurface(255, 255, (u, v) => point.set(u, v, 0), "surface");
    try {
      expect(geometry.getIndex()!.array).toBeInstanceOf(Uint32Array);
      expect(geometry.getIndex()!.getX(geometry.getIndex()!.count - 2)).toBe(65535);
      expect(geometry.getAttribute("position").count).toBe(65536);
    } finally {
      geometry.dispose();
    }
  });

  it("retains winding and independent positions when a sampler reuses scratch", () => {
    const point = new THREE.Vector3();
    const geometry = gridSurface(2, 1, (u, v, column, row) => point.set(u, v, column + row));
    try {
      expect(geometry.getIndex()!.array).toBeInstanceOf(Uint16Array);
      expect(Array.from(geometry.getIndex()!.array)).toEqual([0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4]);
      expect(Array.from(geometry.getAttribute("position").array)).toEqual([
        0, 0, 0, 0.5, 0, 1, 1, 0, 2, 0, 1, 1, 0.5, 1, 2, 1, 1, 3,
      ]);
    } finally {
      geometry.dispose();
    }
  });
});
