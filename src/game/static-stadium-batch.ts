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

type StaticStadiumPolicy = {
  bucket?: CensusBucket;
  shadows?: boolean;
  exclude?: ReadonlySet<THREE.Mesh>;
};

function field<T>(material: THREE.Material, name: string): T | undefined {
  return (material as unknown as Record<string, unknown>)[name] as T | undefined;
}

function vectorKey(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const toArray = (value as { toArray?: () => unknown[] }).toArray;
  return typeof toArray === "function" ? toArray.call(value).join(",") : "";
}

function colorKey(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const color = value as THREE.Color;
  return typeof color.toArray === "function" ? color.toArray().join(",") : "";
}

function textureKey(value: unknown): string {
  const texture = value as THREE.Texture | undefined;
  if (!texture?.isTexture) return "";
  return [
    texture.uuid,
    texture.version,
    texture.matrixAutoUpdate,
    vectorKey(texture.offset),
    vectorKey(texture.repeat),
    vectorKey(texture.center),
    texture.rotation,
    texture.wrapS,
    texture.wrapT,
    texture.flipY,
    texture.channel,
    texture.colorSpace,
  ].join(",");
}

function materialKey(material: THREE.Material): string {
  return [
    material.type,
    material.version,
    colorKey(field(material, "emissive")),
    colorKey(field(material, "sheenColor")),
    colorKey(field(material, "specularColor")),
    colorKey(field(material, "attenuationColor")),
    vectorKey(field(material, "normalScale")),
    vectorKey(field(material, "clearcoatNormalScale")),
    textureKey(field(material, "map")),
    textureKey(field(material, "normalMap")),
    textureKey(field(material, "roughnessMap")),
    textureKey(field(material, "metalnessMap")),
    textureKey(field(material, "alphaMap")),
    textureKey(field(material, "envMap")),
    textureKey(field(material, "emissiveMap")),
    textureKey(field(material, "aoMap")),
    textureKey(field(material, "lightMap")),
    textureKey(field(material, "bumpMap")),
    textureKey(field(material, "displacementMap")),
    field(material, "roughness"),
    field(material, "metalness"),
    field(material, "emissiveIntensity"),
    field(material, "envMapIntensity"),
    field(material, "clearcoat"),
    field(material, "clearcoatRoughness"),
    field(material, "sheen"),
    field(material, "specularIntensity"),
    field(material, "ior"),
    field(material, "transmission"),
    field(material, "thickness"),
    field(material, "attenuationDistance"),
    field(material, "side"),
    field(material, "alphaTest"),
    material.opacity,
    material.transparent,
    material.depthWrite,
    material.depthTest,
    material.toneMapped,
    field(material, "fog"),
    field(material, "vertexColors"),
    field(material, "wireframe"),
    field(material, "wireframeLinewidth"),
    field(material, "dithering"),
    field(material, "premultipliedAlpha"),
    field(material, "flatShading"),
    material.polygonOffset,
    material.polygonOffsetFactor,
    material.polygonOffsetUnits,
  ].join("|");
}

function materialStateKey(material: THREE.Material): string {
  return [materialKey(material), colorKey(field(material, "color"))].join("|");
}

/** Stable render-state signature used to reject a source that moves or changes
 * its material while the descendants are settling or after they were merged. */
export function staticStadiumMeshSignature(mesh: THREE.Mesh): string {
  const material = Array.isArray(mesh.material)
    ? mesh.material.map((item) => materialStateKey(item)).join("~")
    : materialStateKey(mesh.material);
  return [
    mesh.geometry.uuid,
    mesh.matrixWorld.elements.join(","),
    material,
    mesh.castShadow,
    mesh.receiveShadow,
    mesh.renderOrder,
    mesh.layers.mask,
    mesh.frustumCulled,
  ].join("|");
}

function isBatchableMesh(
  mesh: THREE.Mesh,
  group: THREE.Group,
  policy: StaticStadiumPolicy,
  orderedAncestor: boolean,
): mesh is THREE.Mesh & { material: THREE.Material } {
  const material = mesh.material;
  return (
    mesh.isMesh &&
    !(mesh as THREE.InstancedMesh).isInstancedMesh &&
    !(mesh as THREE.SkinnedMesh).isSkinnedMesh &&
    !Array.isArray(material) &&
    !(material as THREE.ShaderMaterial).isShaderMaterial &&
    !(material.transparent && material.alphaTest === 0) &&
    !Object.hasOwn(material, "onBeforeCompile") &&
    !Object.hasOwn(mesh, "onBeforeRender") &&
    !Object.hasOwn(mesh, "onAfterRender") &&
    mesh.userData["staticBatchDynamic"] !== true &&
    !policy.exclude?.has(mesh) &&
    !orderedAncestor &&
    mesh.layers.mask === group.layers.mask
  );
}

export type StaticStadiumBatch = (() => void) & {
  hideSources: () => void;
  changedSources: () => THREE.Mesh[];
};

/** Immutable opaque objects only. Cleanup restores the source meshes; their
 * original geometry and materials always remain owned by the renderer. */
export function batchStaticStadium(
  group: THREE.Group,
  policy: StaticStadiumPolicy = {},
): StaticStadiumBatch {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const batches = new Map<
    string,
    { material: THREE.Material; meshes: THREE.Mesh[]; bucket: CensusBucket }
  >();
  const visit = (object: THREE.Object3D, orderedAncestor = false) => {
    if (
      !object.visible ||
      object.userData["cinematicDynamic"] === true ||
      object.userData["staticBatchDynamic"] === true
    )
      return;
    const ordered = orderedAncestor || object.renderOrder !== 0;
    const mesh = object as THREE.Mesh;
    if (isBatchableMesh(mesh, group, policy, ordered)) {
      const material = mesh.material;
      const bucket = policy.bucket ?? bucketFor(mesh);
      const key = [
        materialKey(material),
        policy.shadows !== false && mesh.castShadow,
        policy.shadows !== false && mesh.receiveShadow,
        bucket,
      ].join("|");
      const batch = batches.get(key);
      if (batch) batch.meshes.push(mesh);
      else batches.set(key, { material, meshes: [mesh], bucket });
    }
    for (const child of object.children) visit(child, ordered);
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
    mesh.castShadow = policy.shadows !== false && batch.meshes[0]!.castShadow;
    mesh.receiveShadow = policy.shadows !== false && batch.meshes[0]!.receiveShadow;
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
  const sourceSignatures = new Map<THREE.Mesh, string>(
    hidden.map((mesh) => [mesh, staticStadiumMeshSignature(mesh)]),
  );
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
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
    changedSources: () => {
      if (disposed) return [];
      group.updateWorldMatrix(true, true);
      return hidden.filter(
        (mesh) => staticStadiumMeshSignature(mesh) !== sourceSignatures.get(mesh),
      );
    },
    hideSources: () => {
      if (disposed) return;
      for (const mesh of hidden) mesh.visible = false;
    },
  });
}
