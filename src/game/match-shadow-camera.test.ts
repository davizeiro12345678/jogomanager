import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { FIELD_X, FIELD_Z, GOAL_NET_DEPTH } from "./sim-rules";
import { matchLighting } from "./match-lighting";
import { matchShadowCamera } from "./match-shadow-camera";

describe("match shadow coverage", () => {
  for (const time of ["dia", "entardecer", "noite"] as const) {
    it(`keeps the pitch, goal nets and airborne athletes inside the ${time} shadow camera`, () => {
      const position = matchLighting(time, "seco", false).keyPosition;
      const bounds = matchShadowCamera(position);
      const camera = new OrthographicCamera(
        bounds.left,
        bounds.right,
        bounds.top,
        bounds.bottom,
        bounds.near,
        bounds.far,
      );
      camera.position.set(...position);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      for (const x of [-FIELD_X - GOAL_NET_DEPTH, FIELD_X + GOAL_NET_DEPTH]) {
        for (const z of [-FIELD_Z - 1, FIELD_Z + 1]) {
          for (const y of [0, 3.5]) {
            const point = new Vector3(x, y, z).project(camera);
            expect(Math.abs(point.x)).toBeLessThan(1);
            expect(Math.abs(point.y)).toBeLessThan(1);
            expect(Math.abs(point.z)).toBeLessThan(1);
          }
        }
      }
    });
  }
});
