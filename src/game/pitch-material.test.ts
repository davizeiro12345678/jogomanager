import { expect, it } from "vitest";
import * as THREE from "three";
import { createPitchSurfaceMaterial } from "./pitch-material";
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
