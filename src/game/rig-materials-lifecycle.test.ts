import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  resetSharedDetailMaterials,
  retainSharedDetailMaterials,
  sharedDetailMaterial,
  sharedDetailMaterialCount,
} from "./rig-materials";

afterEach(resetSharedDetailMaterials);

describe("mounted rig detail ownership", () => {
  it("keeps an evicted material and its owned map alive for both mounted rigs", () => {
    const material = sharedDetailMaterial("leased", () => new THREE.MeshStandardMaterial());
    const texture = new THREE.Texture();
    material.userData["ownedTexture"] = texture;
    const disposed = vi.spyOn(material, "dispose");
    const textureDisposed = vi.spyOn(texture, "dispose");
    const releaseA = retainSharedDetailMaterials([material, material]);
    const releaseB = retainSharedDetailMaterials([material]);
    for (let i = 0; i < 70; i++)
      sharedDetailMaterial(`other-${i}`, () => new THREE.MeshStandardMaterial());
    expect(sharedDetailMaterialCount()).toBe(64);
    expect(disposed).not.toHaveBeenCalled();
    expect(textureDisposed).not.toHaveBeenCalled();
    releaseA();
    releaseA();
    expect(disposed).not.toHaveBeenCalled();
    releaseB();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(textureDisposed).toHaveBeenCalledTimes(1);
  });

  it("reset defers live textures but releases unowned cache entries immediately", () => {
    const live = sharedDetailMaterial("live", () => new THREE.MeshStandardMaterial());
    const idle = sharedDetailMaterial("idle", () => new THREE.MeshStandardMaterial());
    const liveDisposed = vi.spyOn(live, "dispose");
    const idleDisposed = vi.spyOn(idle, "dispose");
    const release = retainSharedDetailMaterials([live]);
    resetSharedDetailMaterials();
    expect(liveDisposed).not.toHaveBeenCalled();
    expect(idleDisposed).toHaveBeenCalledTimes(1);
    release();
    expect(liveDisposed).toHaveBeenCalledTimes(1);
  });
});
