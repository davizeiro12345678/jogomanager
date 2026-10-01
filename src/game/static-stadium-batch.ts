import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { tagCensus, type CensusBucket } from "./scene-census";

function bucketFor(object: THREE.Object3D): CensusBucket {
  let ancestor: THREE.Object3D | null = object;
  while (ancestor) {
    const tag = ancestor.userData["census"];
    if (typeof tag === "string") return tag as CensusBucket;
    ancestor = ancestor.parent;
  }
  return "static";
}

export type StaticStadiumBatch = (() => void) & { hideSources: () => void };

/** Immutable opaque objects only. Cleanup restores the source meshes; their
 * original geometry and materials always remain owned by the renderer. */
export function batchStaticStadium(group: THREE.Group): StaticStadiumBatch {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const batches = new Map<
    string,
    { material: THREE.Material; meshes: THREE.Mesh[]; bucket: CensusBucket }
  >();
  const visit = (object: THREE.Object3D) => {
    if (!object.visible || object.userData["cinematicDynamic"] === true) return;
    const mesh = object as THREE.Mesh;
    if (
      mesh.isMesh &&
      !(mesh as THREE.InstancedMesh).isInstancedMesh &&
      !(mesh as THREE.SkinnedMesh).isSkinnedMesh &&
      !Array.isArray(mesh.material) &&
      !(mesh.material as THREE.ShaderMaterial).isShaderMaterial &&
      !(mesh.material.transparent && mesh.material.alphaTest === 0) &&
      !Object.hasOwn(mesh.material, "onBeforeCompile")
    ) {
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      const bucket = bucketFor(mesh);
      const key = [
        material.type,
        material.map?.uuid,
        material.normalMap?.uuid,
        material.roughnessMap?.uuid,
        material.metalnessMap?.uuid,
        material.alphaMap?.uuid,
        material.envMap?.uuid,
        material.emissiveMap?.uuid,
        material.aoMap?.uuid,
        material.lightMap?.uuid,
        material.bumpMap?.uuid,
        material.displacementMap?.uuid,
        material.normalScale?.toArray().join(","),
        material.roughness,
        material.metalness,
        material.emissive?.getHexString(),
        material.emissiveIntensity,
        material.envMapIntensity,
        material.clearcoat,
        material.clearcoatRoughness,
        material.sheen,
        material.sheenColor?.getHexString(),
        material.specularIntensity,
        material.specularColor?.getHexString(),
        material.side,
        material.alphaTest,
        material.opacity,
        material.depthWrite,
        material.depthTest,
        material.toneMapped,
        material.fog,
        material.flatShading,
        material.polygonOffset,
        material.polygonOffsetFactor,
        material.polygonOffsetUnits,
        mesh.castShadow,
        mesh.receiveShadow,
        bucket,
      ].join("|");
      const batch = batches.get(key);
      if (batch) batch.meshes.push(mesh);
      else batches.set(key, { material, meshes: [mesh], bucket });
    }
    for (const child of object.children) visit(child);
  };
  visit(group);
  const created: THREE.Mesh[] = [];
  const hidden: THREE.Mesh[] = [];
  for (const batch of batches.values()) {
    if (batch.meshes.length < 2) continue;
    const baked = batch.meshes.map((mesh) => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      for (const name of Object.keys(geometry.attributes))
        if (!["position", "normal", "uv", "color"].includes(name)) geometry.deleteAttribute(name);
      const count = geometry.getAttribute("position").count;
      const original = mesh.material as THREE.MeshStandardMaterial;
      const colors = new Float32Array(count * 3);
      const vertexColors = original.vertexColors ? geometry.getAttribute("color") : undefined;
      const color = original.color ?? new THREE.Color("white");
      for (let index = 0; index < count; index++) {
        colors[index * 3] = color.r * (vertexColors?.getX(index) ?? 1);
        colors[index * 3 + 1] = color.g * (vertexColors?.getY(index) ?? 1);
        colors[index * 3 + 2] = color.b * (vertexColors?.getZ(index) ?? 1);
      }
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      return geometry;
    });
    const geometry = mergeGeometries(baked);
    baked.forEach((item) => item.dispose());
    if (!geometry) continue;
    const material = batch.material.clone() as THREE.MeshStandardMaterial;
    material.color?.set("white");
    material.vertexColors = true;
    const mesh = new THREE.Mesh(geometry, material);
    tagCensus(mesh, batch.bucket);
    mesh.castShadow = batch.meshes[0]!.castShadow;
    mesh.receiveShadow = batch.meshes[0]!.receiveShadow;
    group.add(mesh);
    created.push(mesh);
    for (const original of batch.meshes) {
      original.visible = false;
      hidden.push(original);
    }
  }
  group.userData["staticBatch"] = {
    sources: hidden,
    batches: created.length,
    eligible: Array.from(batches.values()).reduce((total, batch) => total + batch.meshes.length, 0),
  };
  const dispose = () => {
    delete group.userData["staticBatch"];
    hidden.forEach((mesh) => {
      mesh.visible = true;
    });
    created.forEach((mesh) => {
      group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
  };
  // React can reapply `visible` while reconciling the source tree. Keep only
  // the merged sources hidden; animated and unbatched children retain control.
  return Object.assign(dispose, {
    hideSources: () => {
      for (const mesh of hidden) mesh.visible = false;
    },
  });
}
