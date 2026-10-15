import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { Kit } from "./kits";
import { lookFor } from "./player-model";

const stream = vi.hoisted(() => ({
  loaded: new Map<string, unknown>(),
  listeners: new Set<(reset?: boolean) => void>(),
}));

vi.mock("./textures/ktx2", () => ({
  ktx2: (name: string) => stream.loaded.get(name) ?? null,
  needsKtx2ProceduralFallback: (_name: string) => false,
  onKtx2Ready: (listener: (reset?: boolean) => void) => {
    stream.listeners.add(listener);
    return () => stream.listeners.delete(listener);
  },
}));

import { detailTextureNames, playerMaterials, retainPlayerMaterials } from "./player-materials";
import { gloveLatexNormal } from "./textures/fabric";

const kit: Kit = {
  base: "#cc2028",
  shorts: "#222222",
  socks: "#222222",
  detail: "#ffffff",
  pattern: "solid",
};

function arrive(name: string, texture: THREE.Texture) {
  stream.loaded.set(name, texture);
  for (const listener of stream.listeners) listener();
}

afterEach(() => {
  stream.loaded.clear();
  for (const listener of stream.listeners) listener(true);
});

it("refreshes only mounted uniforms on arrival and reacquires maps when an inactive cached uniform mounts", () => {
  const look = lookFor("inactive-stream-cache", "MF");
  const set = playerMaterials(look, kit, new THREE.Texture(), "alta");
  const material = set.skin as THREE.MeshStandardMaterial;
  const prior = material.normalMap;
  const texture = new THREE.Texture();
  arrive(detailTextureNames(look, kit)[5], texture);
  expect(material.normalMap).toBe(prior);
  const release = retainPlayerMaterials(set);
  expect(material.normalMap).toBe(texture);
  release();
  stream.loaded.clear();
  for (const listener of stream.listeners) listener(true);
  expect(material.normalMap).not.toBe(texture);
});

it("streams skin and fabric maps without replacing a mounted athlete's materials", () => {
  const look = lookFor("streamed-athlete", "MF");
  const atlas = new THREE.Texture();
  const surface = { sweat: 1, dirt: 1, wet: 0 } as const;
  const set = playerMaterials(look, kit, atlas, "alta", surface);
  const dispose = vi.spyOn(set.jersey, "dispose");
  const release = retainPlayerMaterials(set);
  const roughness = (set.jersey as THREE.MeshStandardMaterial).roughness;
  const [jerseyName, roughName, shortsName, , , skinName] = detailTextureNames(look, kit);
  const fabric = new THREE.Texture();
  const skin = new THREE.Texture();
  const shorts = new THREE.Texture();
  const rough = new THREE.Texture();
  arrive("grassNormal", new THREE.Texture());
  expect(playerMaterials(look, kit, atlas, "alta", surface)).toBe(set);
  arrive(jerseyName, fabric);
  arrive(skinName, skin);
  arrive(shortsName, shorts);
  arrive(roughName, rough);
  expect(playerMaterials(look, kit, atlas, "alta", surface)).toBe(set);
  expect((set.jersey as THREE.MeshStandardMaterial).normalMap).toBe(fabric);
  expect((set.jerseyPlain as THREE.MeshStandardMaterial).normalMap).toBe(fabric);
  expect((set.glove as THREE.MeshStandardMaterial).normalMap).toBe(gloveLatexNormal());
  expect((set.skin as THREE.MeshStandardMaterial).normalMap).toBe(skin);
  expect((set.shorts as THREE.MeshStandardMaterial).normalMap).toBe(shorts);
  expect((set.jersey as THREE.MeshStandardMaterial).roughnessMap).toBe(rough);
  expect((set.jersey as THREE.MeshStandardMaterial).map).toBe(atlas);
  expect((set.jersey as THREE.MeshStandardMaterial).roughness).toBe(roughness);
  expect(dispose).not.toHaveBeenCalled();
  release();
});

it("keeps shader versions stable when a compressed map replaces an existing map", () => {
  const baseNormal = new THREE.Texture();
  arrive("fiberNormal", baseNormal);
  const look = lookFor("stable-fabric-program", "FW");
  const atlas = new THREE.Texture();
  const set = playerMaterials(look, kit, atlas, "alta");
  const release = retainPlayerMaterials(set);
  const material = set.jersey as THREE.MeshStandardMaterial;
  const version = material.version;
  const compressed = new THREE.Texture();
  arrive(detailTextureNames(look, kit)[0], compressed);
  expect(material.normalMap).toBe(compressed);
  expect(material.version).toBe(version);
  arrive("concreteAlbedo", new THREE.Texture());
  expect(material.version).toBe(version);
  compressed.channel = 1;
  const otherUv = new THREE.Texture();
  arrive(detailTextureNames(look, kit)[0], otherUv);
  expect(material.version).toBeGreaterThan(version);
  release();
});

it("updates retained, evicted materials until their final owner releases them", () => {
  const look = lookFor("evicted-live-hair", "DF");
  const set = playerMaterials(look, kit, new THREE.Texture(), "alta");
  const release = retainPlayerMaterials(set);
  const dispose = vi.spyOn(set.hair, "dispose");
  for (let index = 0; index < 100; index++) {
    playerMaterials(look, kit, new THREE.Texture(), "media");
  }
  const hair = set.hair as THREE.MeshStandardMaterial;
  const first = new THREE.Texture();
  arrive("hairNormal", first);
  expect(hair.normalMap).toBe(first);
  expect(dispose).not.toHaveBeenCalled();
  release();
  expect(dispose).toHaveBeenCalledOnce();
  arrive("hairNormal", new THREE.Texture());
  expect(hair.normalMap).toBe(first);
});

it("keeps all high-quality shader features stable as sweat, hair, boot and shin maps arrive", () => {
  const look = lookFor("stable-detail-programs", "MF");
  const set = playerMaterials(look, kit, new THREE.Texture(), "alta");
  const release = retainPlayerMaterials(set);
  const versions = Object.values(set).map((material) => material.version);
  for (const name of [
    "hairNormal",
    "hairRough",
    "bootRough",
    "shinNormal",
    "shinRough",
    "sweatNormal",
    "sweatMask",
  ]) {
    arrive(name, new THREE.Texture());
  }
  for (const name of detailTextureNames(look, kit)) arrive(name, new THREE.Texture());
  expect(Object.values(set).map((material) => material.version)).toEqual(versions);
  release();
});

it("keeps compressed microdetail out of medium and low-quality shader features", () => {
  const look = lookFor("simple-detail-programs", "DF");
  for (const quality of ["media", "baixa"] as const) {
    const set = playerMaterials(look, kit, new THREE.Texture(), quality);
    const versions = Object.values(set).map((material) => material.version);
    arrive("hairNormal", new THREE.Texture());
    arrive("shinNormal", new THREE.Texture());
    expect((set.hair as THREE.MeshStandardMaterial).normalMap).toBeNull();
    expect((set.shin as THREE.MeshStandardMaterial).normalMap).toBeNull();
    expect(Object.values(set).map((material) => material.version)).toEqual(versions);
  }
});
