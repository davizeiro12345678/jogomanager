import * as THREE from "three";

/** Distant cutouts need diffuse lighting, not per-fragment physical reflections. */
export function crowdLodMaterial(tier: number, card: THREE.Texture, physicalCards = false) {
  const base = { vertexColors: true, flatShading: false, side: THREE.DoubleSide };
  if (tier === 2 && !physicalCards)
    return new THREE.MeshLambertMaterial({ ...base, map: card, alphaTest: 0.4 });
  return new THREE.MeshStandardMaterial({
    ...base,
    roughness: 0.93,
    ...(tier === 2 ? { map: card, alphaTest: 0.4 } : {}),
  });
}
