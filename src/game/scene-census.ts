// ============================================================================
//  scene-census.ts
//  Censo de custo de cena por subsistema.
//
//  O `renderer.info` diz o total de desenhos, mas não diz DE ONDE eles vêm. Sem
//  atribuição por subsistema não dá para afirmar que uma melhoria gráfica
//  "coube no orçamento" — e o orçamento de cada tier existe justamente para
//  isso (`GRAPHICS_PROFILES.maxDrawCalls`).
//
//  Este módulo percorre o grafo uma vez por segundo (no benchmark e no medidor
//  de FPS) e classifica cada malha visível no bucket do ancestral marcado com
//  `userData.census`. É puro e não depende de WebGL: roda em teste também.
// ============================================================================

import * as THREE from "three";

import { GRAPHICS_PROFILES, type GraphicsTier } from "./contracts/graphics-profile";

/** Subsistemas da cena. `post` existe para efeitos que não são malhas. */
export type CensusBucket =
  | "player"
  | "playerLow"
  | "crowd"
  | "grass"
  | "props"
  | "static"
  | "goal"
  | "ball"
  | "sky"
  | "other";

export interface CensusEntry {
  /** malhas visíveis que geram desenho */
  meshes: number;
  /** estimativa de draw calls (1 por malha; sombras contam à parte) */
  draws: number;
  /** triângulos estimados (instanciados contam por instância viva) */
  triangles: number;
  /** malhas que projetam sombra (segunda passada de desenho) */
  shadowCasters: number;
  /** bytes dos buffers de geometria únicos e visíveis */
  geometryBytes: number;
  /** estimativa de bytes de textura únicos e visíveis */
  textureBytes: number;
}

export interface SceneCensus {
  buckets: Record<CensusBucket, CensusEntry>;
  /** soma dos buckets */
  total: CensusEntry;
  /** materiais distintos na cena (proxy de programas de shader) */
  materials: number;
}

const BUCKETS: CensusBucket[] = [
  "player",
  "playerLow",
  "crowd",
  "grass",
  "props",
  "static",
  "goal",
  "ball",
  "sky",
  "other",
];

function emptyEntry(): CensusEntry {
  return { meshes: 0, draws: 0, triangles: 0, shadowCasters: 0, geometryBytes: 0, textureBytes: 0 };
}

function emptyCensus(): SceneCensus {
  const buckets = {} as Record<CensusBucket, CensusEntry>;
  for (const bucket of BUCKETS) buckets[bucket] = emptyEntry();
  return { buckets, total: emptyEntry(), materials: 0 };
}

/** Marca um grupo (ou malha) como pertencente a um subsistema do censo. */
export function tagCensus(object: THREE.Object3D, bucket: CensusBucket): void {
  object.userData["census"] = bucket;
}

/**
 * Callback de ref para marcar a raiz de um subsistema direto no JSX:
 * `<group ref={censusRef("crowd")}>`.
 */
export function censusRef(bucket: CensusBucket) {
  return (object: THREE.Object3D | null) => {
    if (object) tagCensus(object, bucket);
  };
}

function isCensusBucket(value: unknown): value is CensusBucket {
  return typeof value === "string" && (BUCKETS as string[]).includes(value);
}

/** Hot LOD budgeting needs draw counts, not a texture/geometry inventory.
 * Create once per scene consumer; its traversal reads no material or buffers.
 * Count empty instances exactly as censusScene does to preserve the budget. */
export function createNonHeroDrawCounter(): (scene: THREE.Object3D) => number {
  let draws = 0;
  const visit = (object: THREE.Object3D, inherited: CensusBucket): void => {
    if (!object.visible) return;
    const own = object.userData["census"];
    const bucket = isCensusBucket(own) ? own : inherited;
    const renderable = object as THREE.Object3D & {
      isMesh?: boolean;
      isPoints?: boolean;
      isLine?: boolean;
      isSprite?: boolean;
    };
    if (
      bucket !== "player" &&
      (renderable.isMesh || renderable.isPoints || renderable.isLine || renderable.isSprite)
    ) {
      draws += object.castShadow ? 2 : 1;
    }
    for (const child of object.children) visit(child, bucket);
  };
  return (scene) => {
    draws = 0;
    visit(scene, "other");
    return draws;
  };
}

/** Instâncias vivas de um `InstancedMesh` (0 quando está vazio). */
function instanceCount(mesh: THREE.InstancedMesh): number {
  const count = mesh.count;
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function trianglesOf(geometry: THREE.BufferGeometry | undefined, instances: number): number {
  if (!geometry || instances <= 0) return 0;
  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");
  const vertices = index ? index.count : position ? position.count : 0;
  return Math.floor(vertices / 3) * instances;
}

function geometryBufferBytes(geometry: THREE.BufferGeometry): number {
  const buffers = new Set<ArrayBufferLike>();
  const add = (attribute: unknown) => {
    if (!attribute || typeof attribute !== "object") return;
    const value = attribute as {
      array?: ArrayBufferView;
      data?: { array?: ArrayBufferView };
    };
    const array = value.array ?? value.data?.array;
    if (array?.buffer) buffers.add(array.buffer);
  };
  for (const attribute of Object.values(geometry.attributes)) add(attribute);
  for (const attributes of Object.values(geometry.morphAttributes))
    for (const attribute of attributes ?? []) add(attribute);
  add(geometry.index);
  let bytes = 0;
  for (const buffer of buffers) bytes += buffer.byteLength;
  return bytes;
}

const MATERIAL_TEXTURE_KEYS = [
  "alphaMap",
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
  "transmissionMap",
  "thicknessMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "anisotropyMap",
] as const;

function textureMemoryBytes(texture: THREE.Texture): number {
  const mips = (texture as THREE.Texture & { mipmaps?: { data?: ArrayBufferView }[] }).mipmaps;
  if (mips?.length) return mips.reduce((sum, level) => sum + (level.data?.byteLength ?? 0), 0);
  const image = texture.image as
    | {
        data?: ArrayBufferView;
        width?: number;
        height?: number;
        videoWidth?: number;
        videoHeight?: number;
      }
    | undefined;
  if (image?.data?.byteLength) return image.data.byteLength;
  const width = image?.width ?? image?.videoWidth ?? 0;
  const height = image?.height ?? image?.videoHeight ?? 0;
  if (width <= 0 || height <= 0) return 0;
  // Browser color/depth format and driver tiling are device-specific. RGBA8
  // with a full mip chain is a conservative, comparable estimate.
  return Math.ceil(width * height * 4 * (texture.generateMipmaps ? 4 / 3 : 1));
}

/**
 * Percorre a cena e soma custo por subsistema. Malhas invisíveis são
 * ignoradas; um `InstancedMesh` conta como 1 desenho e N triângulos.
 */
export function censusScene(scene: THREE.Object3D): SceneCensus {
  const census = emptyCensus();
  const materials = new Set<string>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();

  const visit = (object: THREE.Object3D, inherited: CensusBucket) => {
    if (!object.visible) return;
    const own = object.userData?.["census"];
    const bucket = isCensusBucket(own) ? own : inherited;
    const mesh = object as THREE.Mesh;
    const instanced = object as THREE.InstancedMesh;
    const isRenderable =
      object.visible &&
      ((mesh as { isMesh?: boolean }).isMesh === true ||
        (object as { isPoints?: boolean }).isPoints === true ||
        (object as { isLine?: boolean }).isLine === true ||
        (object as { isSprite?: boolean }).isSprite === true);

    if (isRenderable) {
      const entry = census.buckets[bucket];
      const instances =
        (instanced as { isInstancedMesh?: boolean }).isInstancedMesh === true
          ? instanceCount(instanced)
          : 1;
      entry.meshes += 1;
      entry.draws += 1;
      entry.triangles += trianglesOf(mesh.geometry, instances);
      if (mesh.castShadow) entry.shadowCasters += 1;
      if (mesh.geometry && !geometries.has(mesh.geometry)) {
        geometries.add(mesh.geometry);
        entry.geometryBytes += geometryBufferBytes(mesh.geometry);
      }
      const material = mesh.material;
      if (material) {
        for (const item of Array.isArray(material) ? material : [material]) {
          if (!item) continue;
          if (item.uuid) materials.add(item.uuid);
          const candidate = item as THREE.Material & Record<string, unknown>;
          for (const key of MATERIAL_TEXTURE_KEYS) {
            const map = candidate[key];
            if (
              map &&
              (map as { isTexture?: boolean }).isTexture &&
              !textures.has(map as THREE.Texture)
            ) {
              textures.add(map as THREE.Texture);
              entry.textureBytes += textureMemoryBytes(map as THREE.Texture);
            }
          }
        }
      }
    }

    for (const child of object.children) visit(child, bucket);
  };

  visit(scene, "other");

  for (const bucket of BUCKETS) {
    const entry = census.buckets[bucket];
    census.total.meshes += entry.meshes;
    census.total.draws += entry.draws;
    census.total.triangles += entry.triangles;
    census.total.shadowCasters += entry.shadowCasters;
    census.total.geometryBytes += entry.geometryBytes;
    census.total.textureBytes += entry.textureBytes;
  }
  census.materials = materials.size;
  return census;
}

/** Desenhos estimados de um bucket (atalho para testes e overlay). */
export function censusDraws(census: SceneCensus, bucket: CensusBucket): number {
  return census.buckets[bucket].draws;
}

/** Um censo cabe no orçamento do tier quando os desenhos somados respeitam o contrato. */
export function censusFitsBudget(census: SceneCensus, tier: GraphicsTier): boolean {
  return census.total.draws <= GRAPHICS_PROFILES[tier].maxDrawCalls;
}

/** Uso do orçamento de desenhos (0..∞; >1 estourou). */
export function censusBudgetUse(census: SceneCensus, tier: GraphicsTier): number {
  const budget = GRAPHICS_PROFILES[tier].maxDrawCalls;
  return budget > 0 ? census.total.draws / budget : 0;
}

/** Linha única para log/overlay: `players 120 draws · crowd 54 · …`. */
export function formatCensus(census: SceneCensus): string {
  const parts = BUCKETS.filter((bucket) => census.buckets[bucket].draws > 0).map(
    (bucket) => `${bucket} ${census.buckets[bucket].draws}`,
  );
  return parts.length ? parts.join(" · ") : "vazio";
}
