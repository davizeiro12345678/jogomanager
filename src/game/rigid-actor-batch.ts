import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface RigidActorBatch {
  meshes: THREE.SkinnedMesh[];
  sources: THREE.Mesh[];
  sync(): void;
  dispose(): void;
}

/** Preserve each rigid part's animation with a bone, while compatible opaque
 * surfaces share a draw. Source refs remain alive for the existing animators. */
export function batchRigidActors(root: THREE.Group): RigidActorBatch {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const sources: THREE.Mesh[] = [];
  root.traverseVisible((object) => {
    const mesh = object as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (
      mesh.isMesh &&
      !(mesh as THREE.SkinnedMesh).isSkinnedMesh &&
      !(mesh as THREE.InstancedMesh).isInstancedMesh &&
      material?.isMeshStandardMaterial &&
      !(material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial &&
      !material.transparent &&
      !material.map &&
      !material.normalMap &&
      !material.alphaMap &&
      !material.roughnessMap &&
      !material.metalnessMap &&
      !material.emissiveMap &&
      !material.aoMap &&
      !material.lightMap &&
      !material.bumpMap &&
      !material.displacementMap &&
      !Object.hasOwn(material, "onBeforeCompile") &&
      Object.keys(mesh.geometry.morphAttributes).length === 0
    )
      sources.push(mesh);
  });
  const boneRoot = new THREE.Bone();
  const bones = sources.map((source) => {
    const bone = new THREE.Bone();
    bone.matrixAutoUpdate = false;
    bone.matrix.multiplyMatrices(inverse, source.matrixWorld);
    boneRoot.add(bone);
    return bone;
  });
  root.add(boneRoot);
  root.updateWorldMatrix(true, true);
  const skeleton = new THREE.Skeleton(bones);
  const buckets = new Map<
    string,
    { material: THREE.MeshStandardMaterial; parts: THREE.BufferGeometry[]; source: THREE.Mesh }
  >();
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index]!;
    const material = source.material as THREE.MeshStandardMaterial;
    const key = [
      material.roughness,
      material.metalness,
      material.envMap?.uuid,
      material.envMapIntensity,
      material.emissive.getHexString(),
      material.emissiveIntensity,
      material.side,
      material.flatShading,
      material.toneMapped,
      material.fog,
      material.depthTest,
      material.depthWrite,
      source.castShadow,
      source.receiveShadow,
    ].join("|");
    const geometry = source.geometry.index
      ? source.geometry.toNonIndexed()
      : source.geometry.clone();
    geometry.applyMatrix4(bones[index]!.matrix);
    for (const name of Object.keys(geometry.attributes))
      if (!["position", "normal", "uv", "color"].includes(name)) geometry.deleteAttribute(name);
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    if (!geometry.getAttribute("uv"))
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    const authored = material.vertexColors ? geometry.getAttribute("color") : undefined;
    const colors = new Float32Array(count * 3);
    const indices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let vertex = 0; vertex < count; vertex++) {
      colors[vertex * 3] = material.color.r * (authored?.getX(vertex) ?? 1);
      colors[vertex * 3 + 1] = material.color.g * (authored?.getY(vertex) ?? 1);
      colors[vertex * 3 + 2] = material.color.b * (authored?.getZ(vertex) ?? 1);
      indices[vertex * 4] = index;
      weights[vertex * 4] = 1;
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
    const bucket = buckets.get(key);
    if (bucket) bucket.parts.push(geometry);
    else buckets.set(key, { material, parts: [geometry], source });
  }
  const meshes: THREE.SkinnedMesh[] = [];
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.parts)!;
    bucket.parts.forEach((part) => part.dispose());
    const material = bucket.material.clone();
    material.color.set("white");
    material.vertexColors = true;
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.castShadow = bucket.source.castShadow;
    mesh.receiveShadow = bucket.source.receiveShadow;
    root.add(mesh);
    mesh.bind(skeleton, root.matrixWorld.clone());
    meshes.push(mesh);
  }
  for (const source of sources) source.visible = false;
  root.userData["rigidActorBatch"] = { sources, draws: meshes.length, bones: bones.length };
  let disposed = false;
  return {
    meshes,
    sources,
    sync() {
      if (disposed) return;
      root.updateWorldMatrix(true, true);
      inverse.copy(root.matrixWorld).invert();
      for (let index = 0; index < sources.length; index++) {
        const source = sources[index]!;
        source.visible = false;
        bones[index]!.matrix.multiplyMatrices(inverse, source.matrixWorld);
        bones[index]!.matrixWorldNeedsUpdate = true;
      }
      boneRoot.updateWorldMatrix(false, true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      delete root.userData["rigidActorBatch"];
      for (const source of sources) source.visible = true;
      for (const mesh of meshes) {
        root.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      root.remove(boneRoot);
      skeleton.dispose();
    },
  };
}
