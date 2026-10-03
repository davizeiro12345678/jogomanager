import { expect, it, vi } from "vitest";
import * as THREE from "three";
import type { Kit } from "./kits";
import { lookFor } from "./player-model";
import { playerMaterials, retainPlayerMaterials } from "./player-materials";
import { shortsPanelNormal } from "./textures/fabric";

it("shares a bounded, non-plastic shorts surface without allocating a map per player", () => {
  const first = shortsPanelNormal(),
    second = shortsPanelNormal();
  expect(first).toBe(second);
  expect(first.image.width).toBe(64);
  expect(first.image.height).toBe(64);
  expect(first.wrapS).toBe(THREE.RepeatWrapping);
  const pixels = first.image.data!;
  expect(pixels.byteLength).toBe(64 * 64 * 4);
  let variation = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const x = (Number(pixels[i]) / 255) * 2 - 1,
      y = (Number(pixels[i + 1]) / 255) * 2 - 1,
      z = (Number(pixels[i + 2]) / 255) * 2 - 1;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 1);
    expect(z).toBeGreaterThan(0.95);
    if (Math.abs(x) + Math.abs(y) > 0.06) variation++;
  }
  expect(variation).toBeGreaterThan(1000);
});

it("shares a small latex surface between keeper gloves while preserving distinct fabric and skin response", () => {
  const look = lookFor("latex-keeper", "GK");
  const kit: Kit = {
    base: "#ffff00",
    shorts: "#101418",
    socks: "#ffff00",
    detail: "#101418",
    pattern: "solid",
  };
  const first = playerMaterials(look, kit, null, "alta");
  const second = playerMaterials({ ...look, gloveColor: "#ffffff" }, kit, null, "alta");
  const glove = first.glove as THREE.MeshPhysicalMaterial;
  expect(glove.normalMap).toBe((second.glove as THREE.MeshPhysicalMaterial).normalMap);
  expect(glove.normalMap).not.toBe((first.jersey as THREE.MeshPhysicalMaterial).normalMap);
  expect((glove.normalMap as THREE.DataTexture).image.width).toBe(64);
  expect(glove.metalness).toBe(0);
  expect(glove.clearcoat).toBeLessThan(0.3);
  expect((first.boot as THREE.MeshPhysicalMaterial).roughness).toBeLessThan(glove.roughness);
  expect((first.skin as THREE.MeshPhysicalMaterial).clearcoat).toBeLessThan(glove.clearcoat);
});

it("keeps a shared uniform alive through LRU eviction until both rigs release it", () => {
  const look = lookFor("live-uniform", "MF");
  const kit: Kit = {
    base: "#cc2028",
    shorts: "#222222",
    socks: "#222222",
    detail: "#ffffff",
    pattern: "solid",
  };
  const texture = new THREE.Texture();
  const set = playerMaterials(look, kit, texture, "media");
  const dispose = vi.spyOn(set.jersey, "dispose");
  const first = retainPlayerMaterials(set);
  const second = retainPlayerMaterials(set);
  for (let n = 0; n < 110; n++) {
    const alternate = new THREE.Texture();
    playerMaterials(look, kit, alternate, "media");
    alternate.dispose();
  }
  expect(dispose).not.toHaveBeenCalled();
  first();
  expect(dispose).not.toHaveBeenCalled();
  second();
  expect(dispose).toHaveBeenCalledTimes(1);
  second();
  expect(dispose).toHaveBeenCalledTimes(1);
  texture.dispose();
});
