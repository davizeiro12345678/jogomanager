import * as THREE from "three";

/** Explicit opt-in for native WebGPU temporal reprojection. */
export function temporalAAOptedIn(): boolean {
  try {
    return globalThis.localStorage?.getItem("manager3d.webgpu.traa") === "on";
  } catch {
    return false;
  }
}

/** Independent previous camera matrices remain stable across multi-pass draws. */
export class TemporalCameraHistory {
  readonly previousWorldInverse = new THREE.Matrix4();
  readonly previousProjection = new THREE.Matrix4();
  valid = false;

  capture(camera: THREE.Camera): void {
    this.previousWorldInverse.copy(camera.matrixWorldInverse);
    this.previousProjection.copy(camera.projectionMatrix);
    this.valid = true;
  }

  reset(): void {
    this.valid = false;
  }
}
