import { expect, it } from "vitest";
import * as THREE from "three";
import { createPitchSurfaceMaterial } from "./pitch-material";

it("separates native and merged shader programs even with identical cached maps", () => {
  const texture = new THREE.Texture();
  const options = {
    albedo: texture,
    roughness: texture,
    normal: texture,
    normalScale: new THREE.Vector2(0.4, 0.4),
    wear: texture,
    markings: texture,
    wearOpacity: 0.2,
    tint: new THREE.Color("white"),
    wet: 0.9,
    high: true,
  };
  const merged = createPitchSurfaceMaterial({ ...options, mergeLayers: true });
  const native = createPitchSurfaceMaterial({ ...options, mergeLayers: false });
  expect(merged.customProgramCacheKey()).not.toBe(native.customProgramCacheKey());
  expect(native.onBeforeCompile).toBe(THREE.Material.prototype.onBeforeCompile);
  const source = THREE.ShaderLib.physical;
  const shader = {
    uniforms: { ...source.uniforms },
    vertexShader: source.vertexShader,
    fragmentShader: source.fragmentShader,
  };
  merged.onBeforeCompile(
    shader as Parameters<typeof merged.onBeforeCompile>[0],
    {} as THREE.WebGLRenderer,
  );
  expect(shader.fragmentShader).toContain("pitchPaintCoverage");
  expect(source.fragmentShader).not.toContain("pitchPaintCoverage");
  const equivalent = createPitchSurfaceMaterial(options);
  expect(merged.customProgramCacheKey()).toBe(equivalent.customProgramCacheKey());
  equivalent.dispose();
  merged.dispose();
  native.dispose();
  texture.dispose();
});
it("retains cached pitch maps in one opaque surface and reserves the wet coat for rain", () => {
  const map = new THREE.Texture();
  let disposed = false;
  map.addEventListener("dispose", () => {
    disposed = true;
  });
  const options = {
    albedo: map,
    roughness: map,
    normal: map,
    normalScale: new THREE.Vector2(0.4, 0.4),
    wear: map,
    markings: map,
    wearOpacity: 0.4,
    tint: new THREE.Color("white"),
    wet: 0,
    high: true,
  };
  const dry = createPitchSurfaceMaterial(options);
  const rain = createPitchSurfaceMaterial({ ...options, wet: 0.9 });
  expect(dry).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(dry).not.toBeInstanceOf(THREE.MeshPhysicalMaterial);
  expect(rain).toBeInstanceOf(THREE.MeshPhysicalMaterial);
  expect((rain as THREE.MeshPhysicalMaterial).clearcoat).toBeGreaterThan(0);
  expect((rain as THREE.MeshPhysicalMaterial).clearcoatRoughness).toBeGreaterThan(0.45);
  expect(dry.transparent).toBe(false);
  expect(dry.depthWrite).toBe(true);
  expect(dry.map).toBe(map);
  const native = createPitchSurfaceMaterial({ ...options, mergeLayers: false });
  expect(native.onBeforeCompile).toBe(THREE.Material.prototype.onBeforeCompile);
  native.dispose();
  dry.dispose();
  rain.dispose();
  expect(disposed).toBe(false);
  map.dispose();
});

it("keeps dry mowing response and reuses paint coverage across colour, roughness and normal", () => {
  const texture = new THREE.Texture();
  const material = createPitchSurfaceMaterial({
    albedo: texture,
    roughness: texture,
    normal: texture,
    normalScale: new THREE.Vector2(0.4, 0.4),
    wear: texture,
    markings: texture,
    microRoughness: texture,
    wearOpacity: 0.2,
    tint: new THREE.Color("white"),
    wet: 0,
    high: true,
  });
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
  expect(shader.fragmentShader.match(/texture2D\(pitchMarkings,/g)).toHaveLength(1);
  expect(shader.fragmentShader.match(/texture2D\(pitchWear,/g)).toHaveLength(1);
  expect(shader.fragmentShader).toContain("soil.a * pitchWearOpacity");
  expect(shader.fragmentShader).toContain("pitchPaintCoverage * 0.6");
  expect(shader.fragmentShader).toContain("material.clearcoat *= mix(0.28, 0.9");
  expect(shader.fragmentShader).toContain("material.clearcoat *= 1.0 - pitchPaintCoverage * 0.45");
  expect(shader.uniforms).toHaveProperty("pitchWet", { value: 0 });
  expect(material.roughnessMap).toBe(texture);
  material.dispose();
  texture.dispose();
});
