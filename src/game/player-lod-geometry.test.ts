import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createLowPlayerGeometries } from "./player-lod-geometry";
import { anatomicalLimb, fittedLimbCover, footballBoot } from "./rig-geometry";

const triangles = (geometry: THREE.BufferGeometry) =>
  (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;

describe("distant player geometry", () => {
  it("reduces distant anatomy buffers without changing the full studio geometry", () => {
    const full = createLowPlayerGeometries();
    const compact = createLowPlayerGeometries(true);
    let fullTriangles = 0,
      compactTriangles = 0;
    for (const name of Object.keys(full)) {
      fullTriangles += triangles(full[name]!);
      compactTriangles += triangles(compact[name]!);
      const position = compact[name]!.getAttribute("position");
      expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
      full[name]!.dispose();
      compact[name]!.dispose();
    }
    expect(compactTriangles).toBeLessThan(fullTriangles * 0.8);
  });
  it("keeps the whole team below 58,000 triangles even with the largest hair and socks", () => {
    const geometries = createLowPlayerGeometries();
    const hair = Math.max(
      ...["cropped", "textured", "tied", "crest"].map((name) => triangles(geometries[name]!)),
    );
    const socks = Math.max(
      ...["socksLow", "socksMid", "socksHigh"].map((name) => triangles(geometries[name]!)),
    );
    const body = ["torso", "hips", "head", "neck", "shadow"].reduce(
      (sum, name) => sum + triangles(geometries[name]!),
      hair,
    );
    const limb = ["arms", "forearms", "hands", "sleeves", "thighs", "shins", "boots"].reduce(
      (sum, name) => sum + triangles(geometries[name]!),
      socks,
    );
    expect((body + limb * 2) * 22).toBeLessThan(58_000);
    for (const geometry of Object.values(geometries)) {
      expect(triangles(geometry)).toBeGreaterThan(0);
      for (const attribute of ["position", "normal", "uv"])
        expect(Array.from(geometry.getAttribute(attribute).array).every(Number.isFinite)).toBe(
          true,
        );
      geometry.dispose();
    }
  });

  it("preserves thigh openings, ankle ends and muscle volume while removing intermediate rings", () => {
    const geometries = createLowPlayerGeometries();
    const reference = {
      thighs: fittedLimbCover("thigh", 1, 0.5, 8, 0.43, 0).translate(0, 0.5, 0),
      shins: anatomicalLimb("calf", 1, 0.5, 8, true).translate(0, 0.5, 0),
      boots: footballBoot(1, 0.5, 8),
    };
    for (const [name, original] of Object.entries(reference)) {
      const lighter = geometries[name]!;
      original.computeBoundingBox();
      lighter.computeBoundingBox();
      expect(triangles(lighter)).toBeLessThan(triangles(original));
      for (const edge of ["min", "max"] as const)
        for (const axis of ["x", "y", "z"] as const)
          expect(
            Math.abs(original.boundingBox![edge][axis] - lighter.boundingBox![edge][axis]),
          ).toBeLessThan(0.015);
      original.dispose();
    }
    expect(geometries["thighs"]!.boundingBox!.max.y).toBeCloseTo(0.07, 5);
    for (const geometry of Object.values(geometries)) geometry.dispose();
  });
});
