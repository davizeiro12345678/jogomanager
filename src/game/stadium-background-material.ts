import * as THREE from "three";

/** Matte distant surfaces retain albedo and shadows without the PBR reflection path. */
export function stadiumBackgroundMaterial(source: THREE.MeshStandardMaterial) {
  return new THREE.MeshLambertMaterial({
    color: source.color.clone(),
    map: source.map,
    emissive: source.emissive.clone(),
    emissiveMap: source.emissiveMap,
    emissiveIntensity: source.emissiveIntensity,
    side: source.side,
    vertexColors: source.vertexColors,
    fog: source.fog,
    toneMapped: source.toneMapped,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    depthTest: source.depthTest,
    depthWrite: source.depthWrite,
  });
}
