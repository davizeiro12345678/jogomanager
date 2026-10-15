import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cinematicShotFor } from "./cinematic-shot";
import { cinematicStageFocus } from "./cinematic-blocking";

describe("cinematic master framing", () => {
  it("retains both arrival residents inside the phone master, including shoulders and head", () => {
    for (const aspect of [0.42, 390 / 844, 0.56, 0.78, 16 / 9]) {
      for (const variant of [0, 1, 2]) {
        const shot = cinematicShotFor(
          "arrival",
          "captain",
          "geral",
          aspect,
          false,
          true,
          "arrival",
          variant,
        );
        const camera = new THREE.PerspectiveCamera(shot.fov, aspect, 0.05, 90);
        camera.position.fromArray(shot.position);
        camera.lookAt(new THREE.Vector3(...shot.target));
        camera.updateMatrixWorld(true);
        for (const role of ["captain", "fan"] as const) {
          const mark = cinematicStageFocus("arrival", role, "arrival")!;
          for (const x of [-0.25, 0.25]) {
            for (const y of [1.15, 1.88]) {
              const point = new THREE.Vector3(mark[0] + x, y, mark[1]).project(camera);
              expect(Math.abs(point.x)).toBeLessThan(0.9);
              expect(Math.abs(point.y)).toBeLessThan(0.9);
              expect(point.z).toBeGreaterThan(-1);
              expect(point.z).toBeLessThan(1);
            }
          }
        }
      }
    }
  });

  it("preserves landscape compositions exactly and never moves a portrait master outside its set", () => {
    for (const kind of [
      "locker",
      "office",
      "press",
      "tunnel",
      "pitch",
      "arrival",
      "stands",
    ] as const) {
      for (const art of [undefined, "gym", "medical"] as const) {
        for (const variant of [0, 1, 2]) {
          const baseline = cinematicShotFor(
            kind,
            "manager",
            "geral",
            0.78,
            false,
            true,
            art,
            variant,
          );
          for (const aspect of [1, 4 / 3, 16 / 9, 2.4]) {
            expect(
              cinematicShotFor(kind, "manager", "geral", aspect, false, true, art, variant),
            ).toEqual(baseline);
          }
          for (const aspect of [0.2, 0.42, 0.56]) {
            const portrait = cinematicShotFor(
              kind,
              "manager",
              "geral",
              aspect,
              false,
              true,
              art,
              variant,
            );
            expect(portrait.position).toEqual(baseline.position);
            expect(portrait.target).toEqual(baseline.target);
            expect(portrait.fov).toBeGreaterThan(baseline.fov);
            expect(portrait.fov).toBeLessThanOrEqual(70);
          }
        }
      }
    }
  });

  it("leaves dialogue framing and invalid-aspect fallback unchanged", () => {
    for (const size of ["medio", "proximo", "close"] as const) {
      const wide = cinematicShotFor("office", "manager", size, 16 / 9);
      const portrait = cinematicShotFor("office", "manager", size, 0.42);
      expect(portrait.fov).toBe(wide.fov);
      expect(portrait.framing).toBe("dialogue");
    }
    const baseline = cinematicShotFor("arrival", "captain", "geral", 16 / 9);
    for (const aspect of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(cinematicShotFor("arrival", "captain", "geral", aspect)).toEqual(baseline);
    }
  });
});
