import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TemporalCameraHistory } from "@/game/graphics/temporal-settings";

describe("temporal camera matrices", () => {
  it("keeps separate previous view/projection values during multiple passes", () => {
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 500);
    camera.position.set(0, 18, 30);
    camera.updateMatrixWorld();
    const history = new TemporalCameraHistory();
    history.capture(camera);
    const prev = history.previousProjection.clone();
    const view = history.previousWorldInverse.clone();
    camera.fov = 62;
    camera.updateProjectionMatrix();
    camera.position.set(9, 12, 40);
    camera.updateMatrixWorld();
    expect(history.previousProjection.equals(prev)).toBe(true);
    expect(history.previousWorldInverse.equals(view)).toBe(true);
    expect(camera.projectionMatrix.equals(prev)).toBe(false);
    history.reset();
    expect(history.valid).toBe(false);
    history.capture(camera);
    expect(history.previousProjection.equals(camera.projectionMatrix)).toBe(true);
  });
});
