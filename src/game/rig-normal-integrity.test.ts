import { describe, expect, it } from "vitest";
import { anatomicalLimb, type LimbProfile } from "./rig-geometry";
import { createLowPlayerGeometries } from "./player-lod-geometry";

describe("rig normals entering HDR lighting", () => {
  it("keeps both rigid limb caps outward and unit length at every detail level", () => {
    for (const kind of ["upperArm", "forearm", "thigh", "calf"] satisfies LimbProfile[]) {
      for (const radial of [6, 8, 12, 16]) {
        for (const subdivisions of [1, 4]) {
          const geometry = anatomicalLimb(kind, 0.36, 0.065, radial, true, subdivisions);
          try {
            const positions = geometry.getAttribute("position");
            const normals = geometry.getAttribute("normal");
            const bottom = positions.count - 2 * (radial + 2);
            const top = positions.count - (radial + 2);
            for (let i = 0; i < normals.count; i++) {
              const length = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
              expect(length, `${kind}/${radial}/${subdivisions} vertex ${i}`).toBeCloseTo(1, 5);
            }
            for (let i = bottom; i < top; i++) expect(normals.getY(i)).toBeCloseTo(-1, 5);
            for (let i = top; i < normals.count; i++) expect(normals.getY(i)).toBeCloseTo(1, 5);
          } finally {
            geometry.dispose();
          }
        }
      }
    }
  });

  it("passes only finite unit normals to all distant player instance batches", () => {
    for (const compact of [false, true]) {
      const geometries = createLowPlayerGeometries(compact);
      try {
        for (const [name, geometry] of Object.entries(geometries)) {
          const normals = geometry.getAttribute("normal");
          for (let i = 0; i < normals.count; i++) {
            expect(
              Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)),
              `${name}/${compact} vertex ${i}`,
            ).toBeCloseTo(1, 5);
          }
        }
      } finally {
        for (const geometry of Object.values(geometries)) geometry.dispose();
      }
    }
  });
});
