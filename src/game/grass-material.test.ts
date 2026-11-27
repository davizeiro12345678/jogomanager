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

it("rejects grass contacts outside the influence radius before normalization", () => {
  const { material } = createGrassBladeMaterial();
  try {
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <begin_vertex>\n#include <color_vertex>",
      fragmentShader: "#include <common>\n#include <emissivemap_fragment>",
    };
    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      {} as Parameters<typeof material.onBeforeCompile>[1],
    );
    const guard = "if (dot(offset, offset) > 0.314) continue;";
    const guardIndex = shader.vertexShader.indexOf(guard);
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(guardIndex).toBeLessThan(shader.vertexShader.indexOf("length(offset)"));
    expect(guardIndex).toBeLessThan(shader.vertexShader.indexOf("normalize(offset"));
    expect(shader.vertexShader).toContain("smoothstep(0.12, 0.56, length(offset))");
    expect(shader.vertexShader).toContain("contact * 0.033 * h * h");
    expect(material.customProgramCacheKey()).toContain("v5:");
  } finally {
    material.dispose();
  }
});
