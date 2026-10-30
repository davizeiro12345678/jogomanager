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
});
