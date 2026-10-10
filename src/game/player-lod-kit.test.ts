import { expect, it } from "vitest";
import * as THREE from "three";
import { applyLowKitShader, lowKitPattern } from "./player-lod-kit";

it("preserves club identity in the instance shader without maps or extra draws", () => {
  const material = new THREE.MeshStandardMaterial();
  applyLowKitShader(material);
  const source = THREE.ShaderLib.standard;
  const shader = {
    uniforms: { ...source.uniforms },
    vertexShader: source.vertexShader,
    fragmentShader: source.fragmentShader,
  };
  material.onBeforeCompile(
    shader as Parameters<typeof material.onBeforeCompile>[0],
    {} as THREE.WebGLRenderer,
  );
  expect(shader.vertexShader).toContain("attribute vec4 lowKit");
  expect(shader.fragmentShader).toContain("fwidth(coordinate)");
  expect(material.map).toBeNull();
  expect(lowKitPattern("stripes")).not.toBe(lowKitPattern("hoops"));
  expect(lowKitPattern("solid")).toBe(0);
  material.dispose();
});
