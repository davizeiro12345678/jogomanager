import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RigSkin, RigSkinGroup } from "./rig-skin";

/** Solid costumes keep their albedo, anatomy and skin weights in one draw.
 * Hero detail on high quality retains the original physical materials. */
export function compactCinematicSkin(skin: RigSkin): RigSkin {
  const geometries: THREE.BufferGeometry[] = [];
  const retained: RigSkinGroup[] = [];
  for (const part of skin.groups) {
    const material = part.material as THREE.MeshStandardMaterial;
    if (!material.color || material.map || material.alphaMap || material.transparent) {
      retained.push(part);
      continue;
    }
    const geometry = part.geometry.clone();
    // Retain the shared vertex index: de-indexing multiplies the skinning work.
    if (!geometry.index)
      geometry.setIndex(
        Array.from({ length: geometry.getAttribute("position").count }, (_, i) => i),
      );
    const positions = geometry.getAttribute("position");
    const original = geometry.getAttribute("color");
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      colors[i * 3] = material.color.r * (material.vertexColors && original ? original.getX(i) : 1);
      colors[i * 3 + 1] =
        material.color.g * (material.vertexColors && original ? original.getY(i) : 1);
      colors[i * 3 + 2] =
        material.color.b * (material.vertexColors && original ? original.getZ(i) : 1);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    // These are the complete inputs of the compact skinned shader.
    for (const key of Object.keys(geometry.attributes))
      if (!["position", "normal", "uv", "skinIndex", "skinWeight", "color"].includes(key))
        geometry.deleteAttribute(key);
    if (!geometry.getAttribute("uv"))
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(new Float32Array(positions.count * 2), 2),
      );
    geometries.push(geometry);
  }
  if (!geometries.length) return skin;
  const geometry = mergeGeometries(geometries, false);
  geometries.forEach((part) => part.dispose());
  if (!geometry) return skin;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 0.65;
  const material = new THREE.MeshStandardMaterial({
    color: "white",
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.015,
  });
  material.name = "cinematic-solid-costume";
  const groups: RigSkinGroup[] = [
    { geometry, material, lod: "core", castShadow: true, bone: 0 },
    ...retained,
  ];
  return {
    ...skin,
    groups,
    dispose() {
      geometry.dispose();
      material.dispose();
      skin.dispose();
    },
  };
}
