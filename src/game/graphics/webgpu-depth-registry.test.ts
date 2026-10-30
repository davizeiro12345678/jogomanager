import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  clearWebGpuDepthSnapshot,
  projectionsNearlyEqual,
  publishWebGpuDepthSnapshot,
  webGpuDepthSnapshot,
} from "./webgpu-depth-registry";

describe("native WebGPU Hi-Z snapshot lifecycle", () => {
  it("preserves single-renderer ownership and detects camera updates", () => {
    const device = {};
    const other = {};
    const texture = new THREE.Texture();
    const camera = new THREE.PerspectiveCamera();
    camera.position.z = 4;
    camera.updateMatrixWorld();
    publishWebGpuDepthSnapshot(device, texture, camera);
    expect(webGpuDepthSnapshot(other)).toBeNull();
    const old = webGpuDepthSnapshot(device)!.viewProjection.clone();
    expect(projectionsNearlyEqual(old, webGpuDepthSnapshot(device)!.viewProjection)).toBe(true);
    camera.position.z = 5;
    camera.updateMatrixWorld();
    publishWebGpuDepthSnapshot(device, texture, camera);
    expect(projectionsNearlyEqual(old, webGpuDepthSnapshot(device)!.viewProjection)).toBe(false);
    clearWebGpuDepthSnapshot(device, new THREE.Texture());
    expect(webGpuDepthSnapshot(device)).not.toBeNull();
    clearWebGpuDepthSnapshot(device, texture);
    expect(webGpuDepthSnapshot(device)).toBeNull();
    texture.dispose();
  });
});
