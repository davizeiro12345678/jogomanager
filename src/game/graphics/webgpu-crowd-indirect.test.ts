import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { WebGPURenderer } from "three/webgpu";
import { createCrowdGpuIndirectCommands } from "./webgpu-crowd-indirect";

describe("native GPU-generated crowd draw arguments", () => {
  it("creates compute-generated indirect draw commands per LOD", () => {
    const geometries = [new THREE.PlaneGeometry(), new THREE.BoxGeometry()];
    const compute = vi.fn();
    const renderer = { compute } as unknown as Pick<WebGPURenderer, "compute">;
    const draw = createCrowdGpuIndirectCommands(renderer, geometries);
    expect(geometries.every((g) => g.indirect?.isIndirectStorageBufferAttribute)).toBe(true);
    draw.dispatch([16, 9]);
    expect(compute).toHaveBeenCalledTimes(2);
    draw.dispatch([0, 0]);
    expect(compute).toHaveBeenCalledTimes(4);
    draw.dispose();
    expect(geometries.every((g) => g.indirect === null)).toBe(true);
    for (const geometry of geometries) geometry.dispose();
  });
  it("binds a completed GPU depth texture only for safe whole-pool candidates", () => {
    const geometry = new THREE.PlaneGeometry();
    const compute = vi.fn();
    const renderer = { compute } as unknown as Pick<WebGPURenderer, "compute">;
    const manager = createCrowdGpuIndirectCommands(renderer, [geometry]);
    const texture = new THREE.DataTexture(new Float32Array([0.9, 0, 0, 1]), 1, 1);
    manager.dispatch([12]);
    const fallback = compute.mock.calls[0]![0];
    manager.dispatch([12], { texture, nearestDepths: [0.95] });
    const gpuOcclusion = compute.mock.calls[1]![0];
    expect(gpuOcclusion).not.toBe(fallback);
    manager.dispatch([12], { texture, nearestDepths: [0] });
    expect(compute.mock.calls[2]![0]).toBe(fallback);
    manager.dispose();
    geometry.dispose();
    texture.dispose();
  });
});
