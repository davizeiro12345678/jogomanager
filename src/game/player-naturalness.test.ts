import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildRigBody } from "./rig-body";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { eyelidSurface, faceSurfaceZ, headPoint } from "./player-sculpt";

const kit = {
  base: "#b71928",
  detail: "#15191f",
  pattern: "hoops",
  shorts: "#eeeeee",
  socks: "#b71928",
} as const;

describe("athlete portrait surface continuity", () => {
  it.each([false, true])(
    "settles the attached eyelid edge into the skull with the same pore coordinates (portrait=%s)",
    (portrait) => {
      for (const id of ["studio-fla-MF-1", "orbital-depth-light", "orbital-depth-dark"]) {
        const look = lookFor(id, "MF", true);
        const p = proportionsFor(look);
        for (const side of [-1, 1]) {
          for (const upper of [false, true]) {
            const geometry = eyelidSurface(p, side, look.seed, upper, portrait);
            const position = geometry.getAttribute("position");
            const uv = geometry.getAttribute("uv");
            // The attached row must disappear into the head instead of leaving
            // an elevated strip around the entire eye. Inspect its actual mesh.
            for (let i = 4 * 25; i < position.count; i++) {
              const x = position.getX(i),
                y = position.getY(i);
              const separation = position.getZ(i) - faceSurfaceZ(p, x, y, look.seed);
              expect(separation).toBeGreaterThan(0);
              expect(separation).toBeLessThan(p.headR * 0.002);
              const theta = uv.getX(i) * Math.PI * 2;
              const angle = theta - Math.sin(theta) * 0.6;
              const centered = uv.getY(i) * 2 - 1;
              const skull = headPoint(
                p,
                centered * (0.7 + centered ** 2 * 0.3) * 1.14,
                angle,
                look.seed,
              );
              expect(skull.x).toBeCloseTo(x, 6);
              expect(skull.y).toBeCloseTo(y, 6);
            }
            geometry.dispose();
          }
        }
      }
    },
  );

  it("buries the sleeve apex in the jersey silhouette rather than displaying a separate shoulder cap", () => {
    for (const role of ["MF", "DF", "GK"]) {
      const look = {
        ...lookFor(`natural-shoulder-${role}`, role, true),
        sleeves: "short" as const,
      };
      const p = proportionsFor(look);
      const mats = playerMaterials(look, kit, null, "alta");
      const body = buildRigBody({
        P: p,
        look,
        mats,
        hi: true,
        portrait: false,
        segs: { radial: 12, cap: 4 },
        handR: p.handR,
        handMat: mats.skin,
        jerseyInk: "#ffffff",
      });
      const shirt = body.spine.find((mesh) => mesh.material === mats.jersey)!;
      const torso = new THREE.Mesh(shirt.geometry, mats.jersey);
      torso.updateMatrixWorld(true);
      for (const [side, parts] of [
        [1, body.armL],
        [-1, body.armR],
      ] as const) {
        const sleeve = parts.find((mesh) => mesh.material === mats.jerseyPlain)!;
        sleeve.geometry.computeBoundingBox();
        const top = sleeve.geometry.boundingBox!.max.y;
        const position = sleeve.geometry.getAttribute("position");
        let probes = 0;
        for (let i = 0; i < position.count; i++) {
          if (position.getY(i) < top - 1e-6) continue;
          const x = position.getX(i) + side * p.shoulderW * 0.52;
          const y = position.getY(i) + p.spineLen + p.chestLen * 0.84;
          const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
          expect(
            ray.intersectObject(torso).length,
            `${role} sleeve apex must meet the shirt`,
          ).toBeGreaterThan(0);
          probes++;
        }
        expect(probes).toBeGreaterThan(1);
      }
      body.all.forEach((mesh) => mesh.geometry.dispose());
    }
  });
});
