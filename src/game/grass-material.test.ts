import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { createGrassBladeMaterial } from "./grass-material";

describe("createGrassBladeMaterial", () => {
  it("keeps the dynamic GLSL deformation on the WebGL2 path", () => {
    const { material } = createGrassBladeMaterial("#46824b", { webgl2: true });
    try {
      expect(Object.hasOwn(material, "onBeforeCompile")).toBe(true);
    } finally {
      material.dispose();
    }
  });

  it("uses a standard material on the native WebGPU path", () => {
    const { material } = createGrassBladeMaterial("#46824b", { webgl2: false });
    try {
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(Object.hasOwn(material, "onBeforeCompile")).toBe(false);
      expect(material.customProgramCacheKey()).toContain("webgpu-standard");
    } finally {
      material.dispose();
    }
  });
});
