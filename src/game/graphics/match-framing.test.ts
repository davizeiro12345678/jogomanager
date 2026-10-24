import { expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { framingFor, framingFov, type ShotContext } from "./match-framing";
import { FIELD_X, FIELD_Z } from "../sim-rules";

it("keeps every touchline corner and both goals inside tactical framing on desktop and mobile", () => {
  for (const aspect of [16 / 9, 4 / 3, 390 / 844]) {
    for (const bx of [-FIELD_X, 0, FIELD_X]) {
      const context: ShotContext = {
        bx,
        bz: FIELD_Z,
        speed: 12,
        height: 0.2,
        attackDir: 1,
        pulse: 0,
        nearGoal: 1,
        holder: null,
        heading: 0,
        focusX: null,
        focusZ: null,
      };
      const f = framingFor("tower", context, 0);
      const camera = new PerspectiveCamera(framingFov(f.fov, aspect, true), aspect, 0.1, 500);
      camera.position.set(f.px, f.py, f.pz);
      camera.lookAt(f.lx, f.ly, f.lz);
      camera.updateMatrixWorld();
      for (const x of [-FIELD_X - 5, FIELD_X + 5])
        for (const z of [-FIELD_Z - 1, FIELD_Z + 1]) {
          const projected = new Vector3(x, 0, z).project(camera);
          expect(Math.abs(projected.x)).toBeLessThan(1);
          expect(Math.abs(projected.y)).toBeLessThan(1);
        }
    }
  }
});
