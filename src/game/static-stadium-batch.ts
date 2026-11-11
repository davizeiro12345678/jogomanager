import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { tagCensus, type CensusBucket } from "./scene-census";

export type StaticStadiumBatchPolicy = {
  bucket?: CensusBucket;
  shadows?: boolean;
  exclude?: ReadonlySet<THREE.Mesh>;
};

export interface StaticStadiumState {
  revision: string;
  sourceCount: number;
  eligibleCount: number;
}

type StaticBatchRecord = {
  sources: THREE.Mesh[];
  candidates: THREE.Mesh[];
  generated: THREE.Mesh[];
  batches: number;
  eligible: number;
  revision: string;
  sourceSignatures: Map<THREE.Mesh, string>;
  dispose: () => void;
};

export type StaticStadiumBatch = (() => void) & {
  hideSources: () => void;
  changedSources: () => THREE.Mesh[];
  isCurrent: (revision: string) => boolean;
  readonly revision: string;
  readonly batches: number;
  readonly eligible: number;
};

export interface PreparedStaticStadiumBatch {
  readonly revision: string;
  commit: () => StaticStadiumBatch | null;
  dispose: () => void;
}

function batchRecord(group: THREE.Group): StaticBatchRecord | null {
  const value = group.userData["staticBatch"];
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<StaticBatchRecord>;
  return typeof record.dispose === "function" ? (record as StaticBatchRecord) : null;
}

function disposeExistingBatch(group: THREE.Group): void {
  batchRecord(group)?.dispose();
}

function generatedBatch(object: THREE.Object3D): boolean {
  return object.userData["staticBatchGenerated"] === true;
}

function sourceSet(group: THREE.Group): Set<THREE.Object3D> {
  return new Set(batchRecord(group)?.sources ?? []);
}

function numberRevision(value: number): string {
  return Number.isFinite(value) ? value.toPrecision(12) : String(value);
}

function valueRevision(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return numberRevision(value);
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(valueRevision).join(",")}]`;
  if (typeof value === "object") {
    const candidate = value as {
      uuid?: unknown;
      x?: unknown;
      y?: unknown;
      z?: unknown;
      w?: unknown;
      r?: unknown;
      g?: unknown;
      b?: unknown;
      constant?: unknown;
      offset?: unknown;
      repeat?: unknown;
      center?: unknown;
      rotation?: unknown;
      wrapS?: unknown;
      wrapT?: unknown;
      minFilter?: unknown;
      magFilter?: unknown;
      mapping?: unknown;
      matrixAutoUpdate?: unknown;
      flipY?: unknown;
      anisotropy?: unknown;
      premultiplyAlpha?: unknown;
      format?: unknown;
      type?: unknown;
      unpackAlignment?: unknown;
      colorSpace?: unknown;
      channel?: unknown;
      version?: unknown;
    };
    if (typeof candidate.uuid === "string")
      return [
        candidate.uuid,
        candidate.offset,
        candidate.repeat,
        candidate.center,
        candidate.rotation,
        candidate.wrapS,
        candidate.wrapT,
        candidate.minFilter,
        candidate.magFilter,
        candidate.mapping,
        candidate.matrixAutoUpdate,
        candidate.flipY,
        candidate.anisotropy,
        candidate.premultiplyAlpha,
        candidate.format,
        candidate.type,
        candidate.unpackAlignment,
        candidate.colorSpace,
        candidate.channel,
        candidate.version,
      ]
        .map(valueRevision)
        .join(":");
    if ([candidate.x, candidate.y, candidate.z, candidate.w].some((item) => item !== undefined))
      return [candidate.x, candidate.y, candidate.z, candidate.w, candidate.constant]
        .map(valueRevision)
        .join(",");
    if ([candidate.r, candidate.g, candidate.b].some((item) => item !== undefined))
      return [candidate.r, candidate.g, candidate.b].map(valueRevision).join(",");
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.length)
      return `{${keys.map((key) => `${key}:${valueRevision(record[key])}`).join(",")}}`;
  }
  return String(value);
}

function geometryRevision(geometry: THREE.BufferGeometry): string {
  const attributes = Object.entries(geometry.attributes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, attribute]) => {
      const value = attribute as unknown as Record<string, unknown>;
      return [
        name,
        value["uuid"],
        value["version"],
        attribute.count,
        attribute.itemSize,
        attribute.normalized,
      ]
        .map(valueRevision)
        .join(":");
    })
    .join(";");
  const index = geometry.index;
  return [
    geometry.uuid,
    geometry.drawRange.start,
    geometry.drawRange.count,
    (index as unknown as Record<string, unknown> | null)?.["uuid"],
    (index as unknown as Record<string, unknown> | null)?.["version"],
    index?.count,
    attributes,
    geometry.groups
      .map((group) => `${group.start}:${group.count}:${group.materialIndex}`)
      .join(","),
  ].join("|");
}

const MATERIAL_STATE_KEYS = [
  "alphaTest",
  "alphaHash",
  "alphaToCoverage",
  "allowOverride",
  "blending",
  "blendSrc",
  "blendDst",
  "blendEquation",
  "blendSrcAlpha",
  "blendDstAlpha",
  "blendEquationAlpha",
  "blendAlpha",
  "colorWrite",
  "depthFunc",
  "depthTest",
  "depthWrite",
  "dithering",
  "flatShading",
  "fog",
  "forceSinglePass",
  "opacity",
  "polygonOffset",
  "polygonOffsetFactor",
  "polygonOffsetUnits",
  "premultipliedAlpha",
  "precision",
  "side",
  "stencilWrite",
  "stencilWriteMask",
  "stencilFunc",
  "stencilRef",
  "stencilFuncMask",
  "stencilFail",
  "stencilZFail",
  "stencilZPass",
  "toneMapped",
  "transparent",
  "vertexColors",
  "visible",
  "wireframe",
  "wireframeLinewidth",
] as const;

const MATERIAL_VALUE_KEYS = [
  "attenuationColor",
  "attenuationDistance",
  "anisotropy",
  "anisotropyRotation",
  "clearcoat",
  "clearcoatNormalScale",
  "clearcoatRoughness",
  "combine",
  "dispersion",
  "emissive",
  "emissiveIntensity",
  "envMapIntensity",
  "iridescence",
  "iridescenceIOR",
  "iridescenceThicknessRange",
  "metalness",
  "normalScale",
  "roughness",
  "sheen",
  "sheenColor",
  "sheenRoughness",
  "specularColor",
  "specularIntensity",
  "thickness",
  "transmission",
  "blendColor",
  "clipIntersection",
  "clipShadows",
  "clippingPlanes",
  "depthPacking",
  "defines",
  "extensions",
  "glslVersion",
  "index0AttributeName",
  "normalMapType",
  "shadowSide",
] as const;

const MATERIAL_TEXTURE_KEYS = [
  "alphaMap",
  "anisotropyMap",
  "aoMap",
  "bumpMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "gradientMap",
  "lightMap",
  "map",
  "matcap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "specularColorMap",
  "specularIntensityMap",
  "specularMap",
  "thicknessMap",
  "transmissionMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
] as const;

function materialRenderKey(material: THREE.Material, includeVertexColors = true): string {
  const value = material as THREE.Material & Record<string, unknown>;
  return [
    material.type,
    ...MATERIAL_STATE_KEYS.filter((key) => includeVertexColors || key !== "vertexColors").map(
      (key) => `${key}:${valueRevision(value[key])}`,
    ),
    ...MATERIAL_VALUE_KEYS.map((key) => `${key}:${valueRevision(value[key])}`),
    ...MATERIAL_TEXTURE_KEYS.map((key) => `${key}:${valueRevision(value[key])}`),
    Object.hasOwn(value, "onBeforeCompile"),
    Object.hasOwn(value, "customProgramCacheKey"),
  ].join("|");
}

function materialRevision(material: THREE.Material): string {
  const value = material as THREE.Material & Record<string, unknown>;
  return [
    material.uuid,
    material.version,
    materialRenderKey(material),
    `color:${valueRevision(value["color"])}`,
  ].join("|");
}

function materialHasCustomProgram(material: THREE.Material): boolean {
  const value = material as THREE.Material & Record<string, unknown>;
  return Object.hasOwn(value, "onBeforeCompile") || Object.hasOwn(value, "customProgramCacheKey");
}

function materialHasUnsupportedState(material: THREE.Material): boolean {
  const value = material as THREE.Material & Record<string, unknown>;
  const clippingPlanes = value.clippingPlanes;
  return Array.isArray(clippingPlanes) && clippingPlanes.length > 0;
}

function callbacksAreCustom(mesh: THREE.Mesh): boolean {
  if (
    mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
    mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender
  )
    return true;
  const candidate = mesh as THREE.Mesh & {
    onBeforeShadow?: unknown;
    onAfterShadow?: unknown;
  };
  return (
    (Object.hasOwn(candidate, "onBeforeShadow") && candidate.onBeforeShadow !== undefined) ||
    (Object.hasOwn(candidate, "onAfterShadow") && candidate.onAfterShadow !== undefined)
  );
}

function hasDynamicAncestor(object: THREE.Object3D): boolean {
  let ancestor: THREE.Object3D | null = object;
  while (ancestor) {
    if (
      ancestor.userData["cinematicDynamic"] === true ||
      ancestor.userData["staticBatchDynamic"] === true
    )
      return true;
    ancestor = ancestor.parent;
  }
  return false;
}

function eligibleMesh(mesh: THREE.Mesh, exclude?: ReadonlySet<THREE.Mesh>): boolean {
  if (exclude?.has(mesh)) return false;
  if (
    !mesh.isMesh ||
    (mesh as THREE.InstancedMesh).isInstancedMesh ||
    (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
    Array.isArray(mesh.material) ||
    (mesh.material as THREE.ShaderMaterial).isShaderMaterial ||
    (mesh.material.transparent && mesh.material.alphaTest === 0) ||
    materialHasCustomProgram(mesh.material) ||
    materialHasUnsupportedState(mesh.material) ||
    callbacksAreCustom(mesh) ||
    Boolean(mesh.customDepthMaterial) ||
    Boolean(mesh.customDistanceMaterial) ||
    hasDynamicAncestor(mesh)
  )
    return false;
  return Boolean(mesh.geometry?.getAttribute("position"));
}

function meshEligibilityRevision(mesh: THREE.Mesh): string {
  const materials: THREE.Material[] = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  return [
    Boolean(mesh.geometry?.getAttribute("position")),
    Boolean((mesh as THREE.InstancedMesh).isInstancedMesh),
    Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh),
    Array.isArray(mesh.material),
    materials
      .map((material) =>
        [
          material.type,
          material.transparent,
          material.alphaTest,
          Boolean((material as THREE.ShaderMaterial).isShaderMaterial),
          materialHasCustomProgram(material),
          materialHasUnsupportedState(material),
        ].join(":"),
      )
      .join(","),
    callbacksAreCustom(mesh),
    Boolean(mesh.customDepthMaterial),
    Boolean(mesh.customDistanceMaterial),
  ].join("|");
}

/** Stable source signature used to identify a mesh that moved after commit. */
export function staticStadiumMeshSignature(mesh: THREE.Mesh): string {
  const material = Array.isArray(mesh.material)
    ? mesh.material.map(materialRevision).join("~")
    : materialRevision(mesh.material);
  return [
    mesh.geometry.uuid,
    geometryRevision(mesh.geometry),
    mesh.matrixWorld.elements.map(numberRevision).join(","),
    material,
    mesh.castShadow,
    mesh.receiveShadow,
    mesh.renderOrder,
    mesh.layers.mask,
    mesh.frustumCulled,
  ].join("|");
}

type StaticCaptureCache = {
  materials: Map<THREE.Material, string>;
  geometries: Map<THREE.BufferGeometry, string>;
};

// A capture is synchronous: serialize a shared resource once within this
// pass. Never retain these maps across frames; direct color/UV/buffer changes
// must invalidate the batch on the very next observation.
function materialStateFor(value: THREE.Material, capture: StaticCaptureCache): string {
  let revision = capture.materials.get(value);
  if (revision === undefined) {
    revision = materialRevision(value);
    capture.materials.set(value, revision);
  }
  return revision;
}

function geometryStateFor(value: THREE.BufferGeometry, capture: StaticCaptureCache): string {
  let revision = capture.geometries.get(value);
  if (revision === undefined) {
    revision = geometryRevision(value);
    capture.geometries.set(value, revision);
  }
  return revision;
}

function objectRevision(
  object: THREE.Object3D,
  hiddenSources: Set<THREE.Object3D>,
  includeTransform: boolean,
  capture: StaticCaptureCache,
): string {
  const mesh = object as THREE.Mesh;
  const material = mesh.material;
  const materialState =
    mesh.isMesh && includeTransform
      ? Array.isArray(material)
        ? material.map((value) => materialStateFor(value, capture)).join(",")
        : material
          ? materialStateFor(material, capture)
          : "-"
      : "-";
  return [
    object.uuid,
    object.type,
    hiddenSources.has(object) || object.visible,
    object.layers.mask,
    object.renderOrder,
    includeTransform ? object.matrixAutoUpdate : "-",
    includeTransform ? object.matrixWorldAutoUpdate : "-",
    includeTransform ? object.matrix.elements.map(numberRevision).join(",") : "-",
    includeTransform ? object.matrixWorld.elements.map(numberRevision).join(",") : "-",
    mesh.isMesh ? mesh.castShadow : "-",
    mesh.isMesh ? mesh.receiveShadow : "-",
    mesh.isMesh ? mesh.frustumCulled : "-",
    mesh.isMesh && includeTransform
      ? mesh.geometry && geometryStateFor(mesh.geometry, capture)
      : "-",
    materialState,
    mesh.isMesh ? Boolean((mesh as THREE.InstancedMesh).isInstancedMesh) : "-",
    mesh.isMesh ? Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh) : "-",
    mesh.isMesh ? callbacksAreCustom(mesh) : "-",
    mesh.isMesh && !includeTransform ? meshEligibilityRevision(mesh) : "-",
    object.userData["cinematicDynamic"] === true,
    object.userData["staticBatchDynamic"] === true,
  ].join("|");
}

/** Capture the currently observable source state; generated meshes are ignored. */
export function captureStaticStadiumState(
  group: THREE.Group,
  policy: Pick<StaticStadiumBatchPolicy, "exclude"> = {},
): StaticStadiumState {
  group.updateWorldMatrix(true, true);
  const hiddenSources = sourceSet(group);
  const capture = {
    materials: new Map<THREE.Material, string>(),
    geometries: new Map<THREE.BufferGeometry, string>(),
  };
  const parts: string[] = [];
  let sourceCount = 0;
  let eligibleCount = 0;
  const visit = (object: THREE.Object3D) => {
    if (generatedBatch(object) || (object !== group && hasDynamicAncestor(object))) return;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && policy.exclude?.has(mesh)) {
      for (const child of object.children) visit(child);
      return;
    }
    const includeTransform =
      !hasDynamicAncestor(object) && (!mesh.isMesh || eligibleMesh(mesh, policy.exclude));
    parts.push(objectRevision(object, hiddenSources, includeTransform, capture));
    if (mesh.isMesh && mesh.geometry?.getAttribute("position")) {
      sourceCount += 1;
      if (eligibleMesh(mesh, policy.exclude)) eligibleCount += 1;
    }
    for (const child of object.children) visit(child);
  };
  visit(group);
  return { revision: parts.join("\n"), sourceCount, eligibleCount };
}

function bucketFor(object: THREE.Object3D): CensusBucket {
  let ancestor: THREE.Object3D | null = object;
  while (ancestor) {
    const tag = ancestor.userData["census"];
    if (typeof tag === "string") return tag as CensusBucket;
    ancestor = ancestor.parent;
  }
  return "static";
}

/** Match Three.js' renderer traversal: the nearest Group resets groupOrder. */
function inheritedGroupRenderOrder(mesh: THREE.Mesh): number {
  let ancestor = mesh.parent;
  while (ancestor) {
    if ((ancestor as THREE.Group).isGroup === true) return ancestor.renderOrder;
    ancestor = ancestor.parent;
  }
  return 0;
}

function materialBatchKey(
  material: THREE.Material,
  mesh: THREE.Mesh,
  policy: StaticStadiumBatchPolicy,
  bucket: CensusBucket,
  groupOrder: number,
): string {
  return [
    // Source colours are baked into the canonical vertex colour attribute.
    materialRenderKey(material, false),
    policy.shadows !== false && mesh.castShadow,
    policy.shadows !== false && mesh.receiveShadow,
    mesh.layers.mask,
    groupOrder,
    mesh.renderOrder,
    bucket,
  ].join("|");
}

type BatchGroup = {
  material: THREE.Material;
  meshes: THREE.Mesh[];
  bucket: CensusBucket;
  groupOrder: number;
};
type StagedBatch = { mesh: THREE.Mesh; sources: THREE.Mesh[]; groupOrder: number };

function noOpBatch(state: StaticStadiumState): StaticStadiumBatch {
  let disposed = false;
  const cleanup = () => {
    disposed = true;
  };
  return Object.assign(cleanup, {
    hideSources: () => undefined,
    changedSources: () => [],
    isCurrent: (revision: string) => !disposed && revision === state.revision,
    revision: state.revision,
    batches: 0,
    eligible: state.eligibleCount,
  });
}

function stageGeometry(
  batch: BatchGroup,
  inverse: THREE.Matrix4,
  shadows: boolean,
): THREE.Mesh | null {
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
  const geometry = (() => {
    try {
      return mergeGeometries(baked);
    } finally {
      baked.forEach((item) => item.dispose());
    }
  })();
  if (!geometry) return null;
  const material = batch.material.clone() as THREE.MeshStandardMaterial;
  material.color?.set("white");
  material.vertexColors = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData["staticBatchGenerated"] = true;
  tagCensus(mesh, batch.bucket);
  mesh.castShadow = shadows && batch.meshes[0]!.castShadow;
  mesh.receiveShadow = shadows && batch.meshes[0]!.receiveShadow;
  mesh.layers.mask = batch.meshes[0]!.layers.mask;
  mesh.renderOrder = batch.meshes[0]!.renderOrder;
  return mesh;
}

function commitStagedBatch(
  group: THREE.Group,
  state: StaticStadiumState,
  staged: StagedBatch[],
  candidates: THREE.Mesh[],
  eligible: number,
): StaticStadiumBatch {
  const sources = staged.flatMap((item) => item.sources);
  const previousVisibility = new Map(sources.map((mesh) => [mesh, mesh.visible]));
  const generated = staged.map((item) => item.mesh);
  const generatedParents = staged.map((item) => {
    const parent = new THREE.Group();
    parent.userData["staticBatchGenerated"] = true;
    parent.renderOrder = item.groupOrder;
    parent.add(item.mesh);
    group.add(parent);
    return parent;
  });
  group.updateWorldMatrix(true, true);
  const sourceSignatures = new Map(sources.map((mesh) => [mesh, staticStadiumMeshSignature(mesh)]));
  const candidateSignatures = new Map(
    candidates.map((mesh) => [mesh, staticStadiumMeshSignature(mesh)]),
  );

  let disposed = false;
  const record: StaticBatchRecord = {
    sources,
    candidates,
    generated,
    batches: generated.length,
    eligible,
    revision: state.revision,
    sourceSignatures,
    dispose: () => undefined,
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (group.userData["staticBatch"] === record) delete group.userData["staticBatch"];
    for (const source of sources) source.visible = previousVisibility.get(source) ?? true;
    for (const [index, mesh] of generated.entries()) {
      const parent = generatedParents[index];
      if (parent?.parent) parent.parent.remove(parent);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  };
  record.dispose = dispose;
  group.userData["staticBatch"] = record;
  // This is deliberately the final commit step: no source is hidden before all
  // merged meshes and their metadata have been installed successfully.
  for (const source of sources) source.visible = false;
  return Object.assign(dispose, {
    hideSources: () => {
      if (!disposed) for (const source of sources) source.visible = false;
    },
    changedSources: () => {
      if (disposed) return [];
      group.updateWorldMatrix(true, true);
      return candidates.filter(
        (source) => staticStadiumMeshSignature(source) !== candidateSignatures.get(source),
      );
    },
    isCurrent: (revision: string) => !disposed && revision === state.revision,
    revision: state.revision,
    batches: generated.length,
    eligible,
  });
}

export function prepareStaticStadiumBatch(
  group: THREE.Group,
  policy: StaticStadiumBatchPolicy = {},
): PreparedStaticStadiumBatch {
  group.updateWorldMatrix(true, true);
  const initial = captureStaticStadiumState(group, policy);
  const inverse = group.matrixWorld.clone().invert();
  const batches = new Map<string, BatchGroup>();
  const candidates: THREE.Mesh[] = [];
  const visit = (object: THREE.Object3D) => {
    if (!object.visible || generatedBatch(object) || hasDynamicAncestor(object)) return;
    const mesh = object as THREE.Mesh;
    if (eligibleMesh(mesh, policy.exclude)) {
      candidates.push(mesh);
      const bucket = policy.bucket ?? bucketFor(mesh);
      const groupOrder = inheritedGroupRenderOrder(mesh);
      const key = materialBatchKey(
        mesh.material as THREE.Material,
        mesh,
        policy,
        bucket,
        groupOrder,
      );
      const batch = batches.get(key);
      if (batch) batch.meshes.push(mesh);
      else
        batches.set(key, {
          material: mesh.material as THREE.Material,
          meshes: [mesh],
          bucket,
          groupOrder,
        });
    }
    for (const child of object.children) visit(child);
  };
  visit(group);

  const staged: StagedBatch[] = [];
  for (const batch of batches.values()) {
    if (batch.meshes.length < 2) continue;
    try {
      const mesh = stageGeometry(batch, inverse, policy.shadows !== false);
      if (mesh) staged.push({ mesh, sources: batch.meshes, groupOrder: batch.groupOrder });
    } catch {
      // A failed merge is not a valid commit. The source meshes remain visible.
    }
  }
  const disposeStaged = () => {
    for (const item of staged) {
      item.mesh.geometry.dispose();
      (item.mesh.material as THREE.Material).dispose();
    }
    staged.length = 0;
  };
  let closed = false;
  let result: StaticStadiumBatch | null = null;
  const dispose = () => {
    if (result) {
      result();
      return;
    }
    if (closed) return;
    closed = true;
    disposeStaged();
  };
  return {
    revision: initial.revision,
    commit: () => {
      if (result) return result;
      if (closed) return null;
      if (captureStaticStadiumState(group, policy).revision !== initial.revision) {
        closed = true;
        disposeStaged();
        return null;
      }
      closed = true;
      result = commitStagedBatch(group, initial, staged, candidates, initial.eligibleCount);
      staged.length = 0;
      return result;
    },
    dispose,
  };
}

export function batchStaticStadium(
  group: THREE.Group,
  policy: StaticStadiumBatchPolicy = {},
): StaticStadiumBatch {
  disposeExistingBatch(group);
  const state = captureStaticStadiumState(group, policy);
  const prepared = prepareStaticStadiumBatch(group, policy);
  return prepared.commit() ?? noOpBatch(state);
}
