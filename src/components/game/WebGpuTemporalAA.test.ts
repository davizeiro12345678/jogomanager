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

  it("invalidates distant cinematic cuts while preserving smooth motion", () => {
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 500);
    camera.position.set(0, 18, 30);
    camera.updateMatrixWorld();
    const history = new TemporalCameraHistory();
    expect(history.discontinuity(camera)).toBe(false);
    history.capture(camera);
    camera.position.x = 0.3;
    camera.updateMatrixWorld();
    expect(history.discontinuity(camera)).toBe(false);
    history.capture(camera);
    camera.position.x = 40;
    camera.updateMatrixWorld();
    expect(history.discontinuity(camera)).toBe(true);
  });

  it("recognizes projection replacement without treating tiny zooms as cuts", () => {
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 500);
    camera.updateMatrixWorld();
    const history = new TemporalCameraHistory();
    history.capture(camera);
    camera.fov = 42.1;
    camera.updateProjectionMatrix();
    expect(history.discontinuity(camera)).toBe(false);
    camera.fov = 110;
    camera.updateProjectionMatrix();
    expect(history.discontinuity(camera)).toBe(true);
    history.capture(camera);
    camera.near = 0.3;
    camera.updateProjectionMatrix();
    expect(history.discontinuity(camera)).toBe(true);
  });
});
