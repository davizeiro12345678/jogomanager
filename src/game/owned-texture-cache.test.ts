import { expect, it } from "vitest";
import * as THREE from "three";
import { OwnedTextureCache } from "./owned-texture-cache";

it("keeps multiple active scenes alive and evicts old maps after the last owner leaves", () => {
  const cache = new OwnedTextureCache<string>(1);
  const a = cache.get("a", () => new THREE.Texture())!;
  let disposals = 0;
  a.addEventListener("dispose", () => disposals++);
  const releaseA = cache.retain(a);
  const releaseCloneOwner = cache.retain(a);
  const b = cache.get("b", () => new THREE.Texture())!;
  const releaseB = cache.retain(b);
  const c = cache.get("c", () => new THREE.Texture())!;
  const releaseC = cache.retain(c);
  releaseA();
  expect(disposals).toBe(0);
  releaseB();
  releaseCloneOwner();
  releaseCloneOwner();
  expect(disposals).toBe(1); // last owner released the oldest cached map
  const d = cache.get("d", () => new THREE.Texture())!;
  const releaseD = cache.retain(d);
  releaseC();
  expect(disposals).toBe(1);
  releaseD();
});
