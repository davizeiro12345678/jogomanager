import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lookFor, proportionsFor } from "./player-model";
import { headPoint, lipPatch, eyelidSurface } from "./player-sculpt";
import { buildSculptedFace, faceSurfaceZ } from "./player-sculpt";
import { playerMaterials } from "./player-materials";
import { headComplexion } from "./sculpt/head";

describe("attached facial surface shading", () => {
  it.each(["studio-fla-MF-1", "orbital-depth-dark"])(
    "continues skull albedo into lip and eyelid attachments in both views: %s",
    (id) => {
      const look = lookFor(id, "MF", true);
      const P = proportionsFor(look);
      const expected = new THREE.Color();
      for (const portrait of [false, true])
        for (const lower of [false, true]) {
          const geometries = [
            lipPatch(P, look.seed, lower),
            eyelidSurface(P, 1, look.seed, !lower, portrait),
          ];
          for (const geometry of geometries) {
            const position = geometry.getAttribute("position");
            const color = geometry.getAttribute("color");
            // The outer row is the anatomical attachment, after each patch's
            // own pigment/waterline has vanished. Compare actual authored
            // attributes; merely sharing a material does not ensure this.
            for (let i = position.count - 25; i < position.count; i++) {
              headComplexion(P, position.getX(i), position.getY(i), position.getZ(i), expected);
              expect(color.getX(i)).toBeCloseTo(expected.r, 6);
              expect(color.getY(i)).toBeCloseTo(expected.g, 6);
              expect(color.getZ(i)).toBeCloseTo(expected.b, 6);
            }
            geometry.dispose();
          }
        }
    },
  );

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
