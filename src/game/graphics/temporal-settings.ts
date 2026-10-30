import * as THREE from "three";

/** Explicit opt-in for native WebGPU temporal reprojection. */
export function temporalAAOptedIn(): boolean {
  try {
    return globalThis.localStorage?.getItem("manager3d.webgpu.traa") === "on";
  } catch {
    return false;
  }
}

/** Temporal upscaling is explicitly opt-in and requires native WebGPU.
 * No lower-resolution history is allocated on WebGL2 or by default. */
export function temporalUpscaleOptedIn(): boolean {
  try {
    return globalThis.localStorage?.getItem("manager3d.webgpu.taau") === "on";
  } catch {
    return false;
  }
}

/** Enables the actual GPU compute depth pyramid for native WebGPU only.
 * The depth data never crosses the CPU boundary. */
export function webgpuHiZOptedIn(): boolean {
  try {
    return globalThis.localStorage?.getItem("manager3d.webgpu.hiz") === "on";
  } catch {
    return false;
  }
}

/** r186 TRAANode replaces a camera's pre-existing view offset during its
 * jitter pass. Until the upstream projection-preservation patch is released,
 * use the ordinary renderer for viewports/cameras that specify one. */
export function hasExternalViewOffset(camera: THREE.Camera): boolean {
  const viewCamera = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
  return viewCamera.view?.enabled === true;
}

/** Independent previous camera matrices remain stable across multi-pass draws. */
export class TemporalCameraHistory {
  readonly previousWorldInverse = new THREE.Matrix4();
  readonly previousProjection = new THREE.Matrix4();
  valid = false;
  private readonly previousPosition = new THREE.Vector3();
  private readonly currentPosition = new THREE.Vector3();
  private readonly previousQuaternion = new THREE.Quaternion();
  private readonly currentQuaternion = new THREE.Quaternion();
  private previousNear = 0;
  private previousFar = 0;

  /** A cinematic camera cut, zoom-projection replacement or teleport
   * invalidates all previous color/depth/velocity histories. Ordinary
   * smooth broadcast motion and single-frame jitter must not reset TRAA. */
  discontinuity(camera: THREE.Camera): boolean {
    if (!this.valid) return false;
    this.currentPosition.setFromMatrixPosition(camera.matrixWorld);
    this.currentQuaternion.setFromRotationMatrix(camera.matrixWorld);
    const translation = this.currentPosition.distanceToSquared(this.previousPosition) > 12 * 12;
    const rotation = this.previousQuaternion.angleTo(this.currentQuaternion) > 0.75;
    const projection = camera.projectionMatrix.elements;
    const oldProjection = this.previousProjection.elements;
    // Scale the projection comparison to avoid classifying slight FOV
    // adjustments as camera cuts or floating point subpixel jitter.
    const customProjection =
      Math.abs(projection[0]! - oldProjection[0]!) > 0.45 ||
      Math.abs(projection[5]! - oldProjection[5]!) > 0.45;
    const depthCamera = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    return (
      translation ||
      rotation ||
      customProjection ||
      depthCamera.near !== this.previousNear ||
      depthCamera.far !== this.previousFar
    );
  }

  capture(camera: THREE.Camera): void {
    this.previousWorldInverse.copy(camera.matrixWorldInverse);
    this.previousProjection.copy(camera.projectionMatrix);
    this.previousPosition.setFromMatrixPosition(camera.matrixWorld);
    this.previousQuaternion.setFromRotationMatrix(camera.matrixWorld);
    const depthCamera = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    this.previousNear = depthCamera.near;
    this.previousFar = depthCamera.far;
    this.valid = true;
  }

  reset(): void {
    this.valid = false;
  }
}
