import { expect, it, vi } from "vitest";
import * as THREE from "three";

const { loadedMaps } = vi.hoisted(() => ({ loadedMaps: new Map<string, unknown>() }));
vi.mock("@/game/textures/ktx2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/game/textures/ktx2")>();
  return {
    ...actual,
    ktx2: (name: string) => (loadedMaps.get(name) as THREE.Texture | undefined) ?? null,
    needsKtx2ProceduralFallback: () => true,
  };
});

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

it("pairs seeded leather, synthetic and knit detail maps with their physical finish", () => {
  const look = lookFor("boot-finishes", "FW");
  const kit: Kit = {
    base: "#cc2028",
    shorts: "#222222",
    socks: "#222222",
    detail: "#ffffff",
    pattern: "solid",
  };
  const boots = [0, 9, 18].map(
    (seed) =>
      playerMaterials({ ...look, seed }, kit, null, "alta").boot as THREE.MeshPhysicalMaterial,
  );
  const [leather, synthetic, knit] = boots;
  expect(knit!.roughness).toBeGreaterThan(leather!.roughness);
  expect(leather!.roughness).toBeGreaterThan(synthetic!.roughness);
  expect(knit!.clearcoat).toBeLessThan(leather!.clearcoat);
  expect(leather!.clearcoat).toBeLessThan(synthetic!.clearcoat);
  expect(boots.every((boot) => boot.metalness === 0)).toBe(true);
  const set = playerMaterials(look, kit, null, "alta");
  expect((set.jersey as THREE.MeshPhysicalMaterial).sheen).toBeLessThan(0.35);
  expect((set.jerseyPlain as THREE.MeshPhysicalMaterial).sheen).toBe(
    (set.jersey as THREE.MeshPhysicalMaterial).sheen,
  );
});

it("uses shared compressed skin and fabric normals at medium quality", () => {
  const fiber = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  const skin = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  loadedMaps.set("fiberNormal", fiber);
  loadedMaps.set("skinNormal", skin);

  const look = lookFor("medium-detail", "MF");
  const kit: Kit = {
    base: "#cc2028",
    shorts: "#222222",
    socks: "#222222",
    detail: "#ffffff",
    pattern: "solid",
  };
  const set = playerMaterials(look, kit, null, "media");
  expect((set.jersey as THREE.MeshStandardMaterial).normalMap).toBe(fiber);
  expect((set.jerseyPlain as THREE.MeshStandardMaterial).normalMap).toBe(fiber);
  expect((set.skin as THREE.MeshStandardMaterial).normalMap).toBe(skin);
  expect((set.boot as THREE.MeshStandardMaterial).normalMap).toBeNull();
  expect((set.jersey as THREE.MeshStandardMaterial).normalScale.x).toBeCloseTo(0.18);
  expect(set.jersey).toBeInstanceOf(THREE.MeshStandardMaterial);

  for (const material of Object.values(set)) material.dispose();
  fiber.dispose();
  skin.dispose();
  loadedMaps.clear();
});

it("keeps light shorts and ribbed socks below the satin finish of equipment", () => {
  const look = lookFor("floodlit-white-kit", "MF");
  const kit: Kit = {
    base: "#ffffff",
    detail: "#15191f",
    shorts: "#ffffff",
    socks: "#ffffff",
    pattern: "solid",
  };
  const mats = playerMaterials(look, kit, null, "alta");
  const shorts = mats.shorts as THREE.MeshPhysicalMaterial;
  const socks = mats.socks as THREE.MeshPhysicalMaterial;
  for (const garment of [shorts, socks]) {
    expect(garment.sheen).toBeLessThanOrEqual(0.3);
    expect(garment.roughness).toBeGreaterThanOrEqual(0.9);
    expect(garment.normalScale.length()).toBeLessThan(0.5);
    expect(garment.clearcoat).toBe(0);
  }
  expect(playerMaterials(look, kit, null, "alta")).toBe(mats);
});
