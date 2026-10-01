import { expect, it, vi } from "vitest";
import * as THREE from "three";
import type { Kit } from "./kits";
import { lookFor } from "./player-model";
import { playerMaterials, retainPlayerMaterials } from "./player-materials";

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
