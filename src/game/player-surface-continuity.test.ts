import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lookFor, proportionsFor } from "./player-model";
import { headPoint, lipPatch } from "./player-sculpt";
import { buildSculptedFace, faceSurfaceZ } from "./player-sculpt";
import { playerMaterials } from "./player-materials";

describe("attached facial surface shading", () => {
  it("keeps relaxed mouth details flush with the face instead of stacking projected bars", () => {
    const look = { ...lookFor("studio-fla-MF-1", "MF", true), beard: "none" as const };
    const P = proportionsFor(look);
    const kit = {
      base: "#af1830",
      detail: "#15191f",
      shorts: "#eeeeee",
      socks: "#171b20",
      pattern: "hoops" as const,
    };
    const face = buildSculptedFace(P, look, playerMaterials(look, kit, null, "alta"), true);
    let sampled = 0;
    for (const part of face.face) {
      const positions = part.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(part.matrix);
        if (point.y < -P.headR * 0.42 && point.y > -P.headR * 0.6) {
          const projection = point.z - faceSurfaceZ(P, point.x, point.y, look.seed);
          expect(projection).toBeLessThan(P.headR * 0.003);
          sampled++;
        }
      }
    }
    expect(sampled).toBeGreaterThan(100);
    for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
  });

  it("settles outer lip normals into the continuous facial skin instead of a separate lit rim", () => {
    for (const id of ["studio-fla-MF-1", "orbital-depth-dark"])
      for (const lower of [false, true]) {
        const look = lookFor(id, "MF", true);
        const P = proportionsFor(look);
        const geometry = lipPatch(P, look.seed, lower);
        const positions = geometry.getAttribute("position");
        const normals = geometry.getAttribute("normal");
        const uv = geometry.getAttribute("uv");
        for (let column = 3; column <= 21; column++) {
          const vertex = 6 * 25 + column;
          const theta = uv.getX(vertex) * Math.PI * 2;
          const angle = theta - Math.sin(theta) * 0.6;
          const height = positions.getY(vertex) / P.headR;
          const across = headPoint(P, height, angle + 0.0005, look.seed).sub(
            headPoint(P, height, angle - 0.0005, look.seed),
          );
          const vertical = headPoint(P, height + 0.0005, angle, look.seed).sub(
            headPoint(P, height - 0.0005, angle, look.seed),
          );
          const skinNormal = across.cross(vertical).normalize();
          const lipNormal = new THREE.Vector3().fromBufferAttribute(normals, vertex);
          expect(lipNormal.dot(skinNormal)).toBeGreaterThan(0.999);
        }
        geometry.dispose();
      }
  });
});
