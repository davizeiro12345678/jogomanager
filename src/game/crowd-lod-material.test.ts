import { expect, it } from "vitest";
import * as THREE from "three";
import { crowdLodMaterial } from "./crowd-lod-material";

it("retains physical close supporters and all cutout colours/coverage at distance", () => {
  const card = new THREE.Texture();
  const near = crowdLodMaterial(0, card);
  const middle = crowdLodMaterial(1, card);
  const far = crowdLodMaterial(2, card);
  const legacy = crowdLodMaterial(2, card, true);
  expect(near).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(middle).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(far).toBeInstanceOf(THREE.MeshLambertMaterial);
  expect(legacy).toBeInstanceOf(THREE.MeshStandardMaterial);
  for (const material of [far, legacy]) {
    expect(material.map).toBe(card);
    expect(material.alphaTest).toBe(0.4);
    expect(material.vertexColors).toBe(true);
    expect(material.side).toBe(THREE.DoubleSide);
  }
  [near, middle, far, legacy].forEach((material) => material.dispose());
  card.dispose();
});
