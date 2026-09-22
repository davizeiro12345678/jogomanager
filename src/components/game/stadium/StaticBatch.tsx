import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Only wrap immutable stadium structures, never players, flags or camera rigs.
 * Coalesces equivalent opaque materials without changing their appearance.
 *
 * `signature` is intentionally explicit rather than depending on `children`:
 * React creates new child elements every frame for some parents, while a stadium
 * batch should only be rebuilt when its actual geometry or material inputs change.
 */
export function StaticBatch({
  children,
  signature,
}: {
  children: ReactNode;
  signature?: string | number;
}) {
  const root = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map<string, { material: THREE.Material; geometry: THREE.BufferGeometry[]; meshes: THREE.Mesh[]; cast: boolean; receive: boolean }>();
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material) || !object.visible || object.material.transparent) return;
      const material = object.material;
      // `Material.toJSON()` walks textures and images and was surprisingly
      // expensive when several stadium groups mounted together. A compact
      // appearance key is enough for these immutable opaque batches and keeps
      // the merge work bounded to the actual geometry.
      const appearance = material as THREE.MeshStandardMaterial & {
        map?: THREE.Texture | null;
        color?: THREE.Color;
        roughness?: number;
        metalness?: number;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      const key = [
        material.type,
        appearance.color?.getHexString?.() ?? "",
        appearance.map?.uuid ?? "",
        appearance.roughness ?? "",
        appearance.metalness ?? "",
        appearance.emissive?.getHexString?.() ?? "",
        appearance.emissiveIntensity ?? "",
        String(object.castShadow),
        String(object.receiveShadow),
      ].join("|");
      let batch = batches.get(key);
      if (!batch) { batch = { material, geometry: [], meshes: [], cast: object.castShadow, receive: object.receiveShadow }; batches.set(key, batch); }
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      // All structures use standard PBR attributes. Normalize before merging.
      for (const name of Object.keys(geometry.attributes)) if (!["position", "normal", "uv"].includes(name)) geometry.deleteAttribute(name);
      batch.geometry.push(geometry); batch.meshes.push(object);
    });
    const created: THREE.Mesh[] = [];
    const hidden: THREE.Mesh[] = [];
    for (const batch of batches.values()) {
      if (batch.meshes.length > 1) {
        const geometry = mergeGeometries(batch.geometry);
        if (geometry) {
          const mesh = new THREE.Mesh(geometry, batch.material);
          mesh.castShadow = batch.cast; mesh.receiveShadow = batch.receive;
          group.add(mesh); created.push(mesh);
          batch.meshes.forEach(original => { original.visible = false; hidden.push(original); });
        }
      }
      batch.geometry.forEach(geometry => geometry.dispose());
    }
    return () => { hidden.forEach(mesh => { mesh.visible = true; }); created.forEach(mesh => { group.remove(mesh); mesh.geometry.dispose(); }); };
  }, [signature]);
  return <group ref={root}>{children}</group>;
}
