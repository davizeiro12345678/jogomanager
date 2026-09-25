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
  return { meshes: 0, draws: 0, triangles: 0, shadowCasters: 0 };
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

/**
 * Percorre a cena e soma custo por subsistema. Malhas invisíveis são
 * ignoradas; um `InstancedMesh` conta como 1 desenho e N triângulos.
 */
export function censusScene(scene: THREE.Object3D): SceneCensus {
  const census = emptyCensus();
  const materials = new Set<string>();

  const visit = (object: THREE.Object3D, inherited: CensusBucket) => {
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
      const material = mesh.material;
      if (material) {
        for (const item of Array.isArray(material) ? material : [material]) {
          if (item?.uuid) materials.add(item.uuid);
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
