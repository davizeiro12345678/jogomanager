import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createNativeCrowdMotionMaterial } from "./native-webgpu-crowd-motion";

describe("native WebGPU crowd articulation", () => {
  it("creates a TSL GPU vertex animation and shared animated uniforms", () => {
    const card = new THREE.Texture();
    const detail = createNativeCrowdMotionMaterial(0, card);
    expect(detail.material.positionNode).toBeDefined();
    expect(detail.material.colorNode).toBeDefined();
    expect(detail.uniforms.clock.value).toBe(0);
    detail.uniforms.clock.value = 3;
    detail.uniforms.pulse.value = 0.9;
    expect(detail.uniforms.clock.value).toBe(3);
    expect(detail.uniforms.pulse.value).toBe(0.9);
    detail.material.dispose();
    card.dispose();
  });

  it("keeps billboard alpha when coloring the native WebGPU cards", () => {
    const card = new THREE.Texture();
    const tier = createNativeCrowdMotionMaterial(2, card);
    expect(tier.material.positionNode).toBeDefined();
    expect(tier.material.opacityNode).toBeDefined();
    expect(tier.material.alphaTest).toBe(0.4);
    tier.material.dispose();
    card.dispose();
  });
});
