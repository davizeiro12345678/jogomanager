import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { lookFor, proportionsFor } from "./player-model";
import { skinAlbedo } from "./player-morphology";
import { buildSculptedFace, nostrilSurface, faceSurfaceZ, lipPatch } from "./player-sculpt";
import { playerMaterials } from "./player-materials";
import { eyeWhiteMaterial } from "./rig-materials";
import { headComplexion } from "./sculpt/head";

const kit = {
  base: "#af1830",
  detail: "#15191f",
  pattern: "hoops",
  shorts: "#eee",
  socks: "#171b20",
} as const;

describe("anatomical facial landmark coherence", () => {
  it.each(["studio-fla-MF-1", "studio-flu-MF-1", "orbital-depth-dark"])(
    "keeps an adult-sized palpebral opening and a continuous relaxed oral span: %s",
    (id) => {
      const look = lookFor(id, "MF", true),
        P = proportionsFor(look);
      const face = buildSculptedFace(P, look, playerMaterials(look, kit, null, "alta"), true);
      const sclera = face.face.filter((p) => p.material === eyeWhiteMaterial(true));
      for (const part of sclera) {
        part.geometry.computeBoundingBox();
        const width = part.geometry.boundingBox!.max.x - part.geometry.boundingBox!.min.x;
        // A broad adult opening around a constant iris, rather than enlarging
        // the eyeball to fill a child-like small eye slit in a wide skull.
        expect(width / (P.headW * 1.8)).toBeGreaterThan(0.175);
        expect(width / (P.headW * 1.8)).toBeLessThan(0.21);
      }
      const mouth = lipPatch(P, look.seed, false);
      mouth.computeBoundingBox();
      const mouthWidth = mouth.boundingBox!.max.x - mouth.boundingBox!.min.x;
      expect(mouthWidth / (P.headR * 1.8)).toBeGreaterThan(0.29);
      expect(mouthWidth / (P.headR * 1.8)).toBeLessThan(0.36);
      mouth.dispose();
      for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
    },
  );

  it("fits elliptical nostrils to alar curvature with a skin-matched perimeter at the original topology cost", () => {
    for (const id of ["studio-fla-MF-1", "orbital-depth-dark"])
      for (const detail of [false, true])
        for (const side of [-1, 1]) {
          const look = lookFor(id, "MF", true),
            P = proportionsFor(look);
          const geometry = nostrilSurface(P, look, side, detail);
          const p = geometry.getAttribute("position"),
            c = geometry.getAttribute("color");
          const material = playerMaterials(look, kit, null, "alta")
            .skin as THREE.MeshStandardMaterial;
          const skin = new THREE.Color(skinAlbedo(look.skin)),
            pigment = new THREE.Color();
          expect(geometry.index!.count / 3).toBe(detail ? 10 : 7);
          for (let i = 0; i < p.count; i++) {
            expect(p.getZ(i) - faceSurfaceZ(P, p.getX(i), p.getY(i), look.seed)).toBeCloseTo(
              P.headR * 0.0009,
              7,
            );
            headComplexion(P, p.getX(i), p.getY(i), p.getZ(i), pigment);
            const expected = skin
              .clone()
              .multiply(pigment)
              .multiplyScalar(i === 0 ? 0.26 : 1);
            expect(c.getX(i) * material.color.r).toBeCloseTo(expected.r, 6);
            expect(c.getY(i) * material.color.g).toBeCloseTo(expected.g, 6);
            expect(c.getZ(i) * material.color.b).toBeCloseTo(expected.b, 6);
          }
          geometry.dispose();
        }
  });
});
