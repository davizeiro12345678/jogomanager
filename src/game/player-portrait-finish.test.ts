import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { eyeWhiteMaterial } from "./rig-materials";
import { buildSculptedFace, eyelidSurface, sculptedEar, faceSurfaceZ } from "./player-sculpt";

const kit = {
  base: "#af1830",
  detail: "#15191f",
  pattern: "hoops",
  shorts: "#eee",
  socks: "#171b20",
} as const;

describe("isolated portrait finish", () => {
  it("closes both lid corners and centres the iris in the visible opening across face identities", () => {
    for (const id of [
      "studio-fla-MF-1",
      "studio-flu-MF-1",
      "orbital-depth-light",
      "orbital-depth-dark",
    ]) {
      const look = lookFor(id, "MF", true),
        p = proportionsFor(look);
      const portrait = buildSculptedFace(
        p,
        look,
        playerMaterials(look, kit, null, "alta"),
        true,
        true,
      );
      const sclera = portrait.face.filter((part) => part.material === eyeWhiteMaterial(true));
      for (const [eye, side] of [-1, 1].entries()) {
        const upper = eyelidSurface(p, side, look.seed, true, true);
        const lower = eyelidSurface(p, side, look.seed, false, true);
        const a = upper.getAttribute("position"),
          b = lower.getAttribute("position");
        for (const corner of [0, 24]) {
          expect(a.getX(corner)).toBe(b.getX(corner));
          expect(a.getY(corner)).toBe(b.getY(corner));
          expect(a.getZ(corner)).toBe(b.getZ(corner));
        }
        const white = sclera[eye]!.geometry.getAttribute("position");
        const centreY = (white.getY(10) + white.getY(6 * 21 + 10)) / 2;
        const pupilCentre = new THREE.Vector3().setFromMatrixPosition(
          portrait.eyes[eye * 4 + 2]!.matrix,
        );
        expect(pupilCentre.y).toBeCloseTo(centreY, 7);
        // Margins cover the adult iris while the outer attachment returns
        // into skin; normal magnitudes stay finite even at closed corners.
        for (const lid of [upper, lower]) {
          const position = lid.getAttribute("position"),
            normal = lid.getAttribute("normal");
          for (let i = 0; i < position.count; i++) {
            const projection =
              position.getZ(i) - faceSurfaceZ(p, position.getX(i), position.getY(i), look.seed);
            expect(projection).toBeLessThan(p.headR * 0.04);
            expect(projection).toBeGreaterThan(-p.headR * 0.005);
            expect(Number.isFinite(normal.getX(i) + normal.getY(i) + normal.getZ(i))).toBe(true);
          }
          lid.dispose();
        }
      }
      for (const parts of Object.values(portrait))
        for (const part of parts) part.geometry.dispose();
    }
  });

  it("rolls the portrait helix back into its attachment without adding vertices or changing match ears", () => {
    const p = proportionsFor(lookFor("portrait-ear", "MF"));
    for (const side of [-1, 1]) {
      const legacy = sculptedEar(p, side, true),
        match = sculptedEar(p, side, true, false);
      const portrait = sculptedEar(p, side, true, true);
      expect(Array.from(match.getAttribute("position").array)).toEqual(
        Array.from(legacy.getAttribute("position").array),
      );
      expect(portrait.getAttribute("position").count).toBe(match.getAttribute("position").count);
      expect(portrait.index!.count).toBe(match.index!.count);
      const a = portrait.getAttribute("position"),
        b = match.getAttribute("position");
      const normals = portrait.getAttribute("normal"),
        originalNormals = match.getAttribute("normal");
      for (let i = 0; i < a.count; i++) {
        const inset = side * (b.getX(i) - a.getX(i));
        expect(inset).toBeGreaterThanOrEqual(-1e-7);
        // v1's abrupt .078R X-only return formed the rejected frontal fin.
        // Bound both displacement and lighting-plane rotation from profile.
        expect(inset).toBeLessThan(p.headR * 0.031);
        expect(Math.abs(a.getY(i) - b.getY(i))).toBeLessThan(p.headR * 0.01);
        expect(Math.abs(a.getZ(i) - b.getZ(i))).toBeLessThan(p.headR * 0.006);
        const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
        const original = new THREE.Vector3().fromBufferAttribute(originalNormals, i);
        expect(normal.dot(original)).toBeGreaterThan(0.8);
      }
      legacy.dispose();
      match.dispose();
      portrait.dispose();
    }
  });
});
