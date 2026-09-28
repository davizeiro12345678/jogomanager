// ============================================================================
//  rig-skin.ts
//  Corpo do atleta em SkinnedMesh: um desenho por grupo de material.
//
//  A malha mesclada por junta (`rig-body.ts`) já tinha resolvido o desperdício
//  dentro de cada articulação, mas o piso é estrutural: 22 juntas animadas ×
//  materiais distintos não cabem em poucos desenhos. Com 54 desenhos por
//  atleta, o perfil Alto (260 desenhos) pagava 3–4 heróis.
//
//  A saída é a mesma geometria, rendida como SkinnedMesh: cada junta vira um
//  osso (`THREE.Bone`) com o MESMO pivô e a MESMA hierarquia dos grupos que a
//  animação já escreve, e as peças são agrupadas por (material, nível de LOD).
//  Um atleta sai de 54 desenhos para ~19 — seis heróis cabem no orçamento.
//
//  A pose de bind é idêntica à da malha mesclada: os vértices continuam
//  autorados no espaço local de cada junta, então `skeleton` na pose de
//  repouso é a identidade e a silhueta não muda em nada.
//
//  Função pura: não cria contexto WebGL e pode ser testada em Node.
// ============================================================================

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { buildRigBody, type RigBody, type RigBodyContext } from "./rig-body";

/** Junta animada → osso. Os nomes batem com os refs de `PlayerRig`. */
export type RigJoint =
  | "hips"
  | "spine"
  | "chest"
  | "neck"
  | "face"
  | "jaw"
  | "blink"
  | "clavL"
  | "armL"
  | "foreL"
  | "handL"
  | "handDetailL"
  | "clavR"
  | "armR"
  | "foreR"
  | "handR"
  | "handDetailR"
  | "legL"
  | "kneeL"
  | "ankleL"
  | "bootDetailL"
  | "legR"
  | "kneeR"
  | "ankleR"
  | "bootDetailR";

/**
 * Nível de LOD do grupo de desenho. `near` some a partir do LOD 1 (rosto,
 * dedos) e `boot` a partir do LOD 2 (travas) — a mesma política da malha
 * mesclada, agora aplicada a grupos de material em vez de malhas.
 */
export type RigSkinLod = "core" | "near" | "boot";

export interface RigSkinGroup {
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
  lod: RigSkinLod;
  castShadow: boolean;
  /** índice do osso dono da geometria (diagnóstico) */
  bone: number;
}

export interface RigSkin {
  /** osso raiz (quadril); filho do grupo que posiciona o atleta */
  root: THREE.Bone;
  /**
   * Matriz de bind: a matriz de mundo do atleta no momento em que o esqueleto
   * foi montado. O three.js só mantém `bindMatrixInverse` em sincronia a cada
   * quadro, então `bindMatrix` precisa ser aplicado à mão em cada malha — sem
   * isso o atleta apareceria deslocado pelo resto da translação do grupo raiz.
   */
  bindMatrix: THREE.Matrix4;
  bones: THREE.Bone[];
  skeleton: THREE.Skeleton;
  groups: RigSkinGroup[];
  all: RigSkinGroup[];
  /** junta → osso, para o componente ligar os refs de animação */
  boneOf: Record<RigJoint, THREE.Bone>;
  /** libera geometrias (materiais são compartilhados) */
  dispose(): void;
}

interface JointSpec {
  joint: RigJoint;
  parent: RigJoint | null;
  /** deslocamento local, igual ao `position` do grupo no JSX */
  offset: readonly [number, number, number];
}

/** Hierarquia de juntas — precisa espelhar `PlayerRig.tsx` ponto a ponto. */
function jointSpecs(P: {
  hipY: number;
  hipH: number;
  spineLen: number;
  chestLen: number;
  neckLen: number;
  headR: number;
  shoulderW: number;
  upperArm: number;
  foreArm: number;
  hipW: number;
  thigh: number;
  shin: number;
}): JointSpec[] {
  return [
    { joint: "hips", parent: null, offset: [0, P.hipY, 0] },
    { joint: "spine", parent: "hips", offset: [0, P.hipH * 0.5, 0] },
    { joint: "chest", parent: "spine", offset: [0, P.spineLen, 0] },
    { joint: "neck", parent: "chest", offset: [0, P.chestLen, 0] },
    // O pivô facial coloca o centro do crânio no alto do pescoço.
    { joint: "face", parent: "neck", offset: [0, P.neckLen + P.headR * 0.82, 0] },
    { joint: "jaw", parent: "face", offset: [0, 0, 0] },
    { joint: "blink", parent: "face", offset: [0, 0, 0] },
    { joint: "clavL", parent: "chest", offset: [0, 0, 0] },
    { joint: "armL", parent: "clavL", offset: [P.shoulderW * 0.52, P.chestLen * 0.84, 0] },
    { joint: "foreL", parent: "armL", offset: [0, -P.upperArm, 0] },
    { joint: "handL", parent: "foreL", offset: [0, -P.foreArm, 0] },
    { joint: "handDetailL", parent: "handL", offset: [0, 0, 0] },
    { joint: "clavR", parent: "chest", offset: [0, 0, 0] },
    { joint: "armR", parent: "clavR", offset: [-P.shoulderW * 0.52, P.chestLen * 0.84, 0] },
    { joint: "foreR", parent: "armR", offset: [0, -P.upperArm, 0] },
    { joint: "handR", parent: "foreR", offset: [0, -P.foreArm, 0] },
    { joint: "handDetailR", parent: "handR", offset: [0, 0, 0] },
    { joint: "legL", parent: "hips", offset: [P.hipW * 0.46, -P.hipH * 0.4, 0] },
    { joint: "kneeL", parent: "legL", offset: [0, -P.thigh, 0] },
    { joint: "ankleL", parent: "kneeL", offset: [0, -P.shin, 0] },
    { joint: "bootDetailL", parent: "ankleL", offset: [0, 0, 0] },
    { joint: "legR", parent: "hips", offset: [-P.hipW * 0.46, -P.hipH * 0.4, 0] },
    { joint: "kneeR", parent: "legR", offset: [0, -P.thigh, 0] },
    { joint: "ankleR", parent: "kneeR", offset: [0, -P.shin, 0] },
    { joint: "bootDetailR", parent: "ankleR", offset: [0, 0, 0] },
  ];
}

/** Junta dona de cada grupo de malha. Crânio e cabelo ficam no pivô facial. */
export const MESH_OWNER: Record<Exclude<keyof RigBody, "all">, RigJoint> = {
  hips: "hips",
  spine: "spine",
  chest: "chest",
  neck: "neck",
  head: "face",
  hair: "face",
  face: "face",
  jaw: "jaw",
  blink: "blink",
  armL: "armL",
  armR: "armR",
  foreL: "foreL",
  foreR: "foreR",
  // a mão não tem osso próprio: é rígida no antebraço
  handL: "foreL",
  handR: "foreR",
  handDetailL: "handDetailL",
  handDetailR: "handDetailR",
  legL: "legL",
  legR: "legR",
  kneeL: "kneeL",
  kneeR: "kneeR",
  ankleL: "ankleL",
  ankleR: "ankleR",
  bootDetailL: "bootDetailL",
  bootDetailR: "bootDetailR",
};

const MESH_LOD: Record<Exclude<keyof RigBody, "all">, RigSkinLod> = {
  hips: "core",
  spine: "core",
  chest: "core",
  neck: "core",
  head: "core",
  hair: "core",
  face: "near",
  jaw: "near",
  blink: "near",
  armL: "core",
  armR: "core",
  foreL: "core",
  foreR: "core",
  handL: "core",
  handR: "core",
  handDetailL: "near",
  handDetailR: "near",
  legL: "core",
  legR: "core",
  kneeL: "core",
  kneeR: "core",
  ankleL: "core",
  ankleR: "core",
  bootDetailL: "boot",
  bootDetailR: "boot",
};

/** Margem da esfera de culling: a pose animada sai da pose de bind. */
const CULL_MARGIN = 0.45;

/**
 * Constrói o corpo em SkinnedMesh.
 *
 * @param ctx        mesmo contexto de `buildRigBody`
 * @param rootOffset posição do atleta no mundo (o grupo raiz da cena)
 */
export function buildRigSkin(
  ctx: RigBodyContext,
  rootOffset: readonly [number, number, number],
): RigSkin {
  const body = buildRigBody(ctx);
  const specs = jointSpecs(ctx.P);

  /* ------------------------------------------------------------- ossos */

  const bones: THREE.Bone[] = [];
  const boneOf = {} as Record<RigJoint, THREE.Bone>;
  for (const spec of specs) {
    const bone = new THREE.Bone();
    bone.name = spec.joint;
    bone.position.fromArray(spec.offset);
    bones.push(bone);
    boneOf[spec.joint] = bone;
  }
  for (const spec of specs) {
    const bone = boneOf[spec.joint];
    const parent = spec.parent ? boneOf[spec.parent] : null;
    if (parent) parent.add(bone);
  }

  /* ------------------------------------------------- pose de bind */

  // A raiz da cena translada o atleta; os ossos e as malhas são filhos dela,
  // então a matriz de bind é exatamente essa translação.
  const bindMatrix = new THREE.Matrix4().makeTranslation(...rootOffset);
  const restWorld = new THREE.Matrix4();
  const boneInverses: THREE.Matrix4[] = [];
  for (const spec of specs) {
    restWorld.copy(bindMatrix);
    // sobe a hierarquia acumulando os deslocamentos locais
    const chain: RigJoint[] = [];
    for (let cursor: RigJoint | null = spec.joint; cursor;) {
      chain.push(cursor);
      cursor = specs.find((s) => s.joint === cursor)?.parent ?? null;
    }
    for (const joint of chain.reverse()) {
      restWorld.multiply(boneOf[joint].matrix);
    }
    boneInverses.push(restWorld.clone().invert());
  }

  const skeleton = new THREE.Skeleton(bones, boneInverses);

  /* ------------------------------------------- geometria com skinning */

  // Matriz de repouso de cada junta NO ESPAÇO LOCAL DA MALHA (sem a translação
  // do grupo raiz). A geometria é autorada no espaço da junta, então precisa
  // desta multiplicação para virar o espaço em que o three.js espera os
  // vértices de um SkinnedMesh — sem ela o atleta aparece desmontado.
  const localRest = new Map<RigJoint, THREE.Matrix4>();
  for (const spec of specs) {
    const chain: RigJoint[] = [];
    for (let cursor: RigJoint | null = spec.joint; cursor;) {
      chain.push(cursor);
      cursor = specs.find((s) => s.joint === cursor)?.parent ?? null;
    }
    const matrix = new THREE.Matrix4();
    for (const joint of chain.reverse()) matrix.multiply(boneOf[joint].matrix);
    localRest.set(spec.joint, matrix);
  }

  const buckets = new Map<
    string,
    {
      material: THREE.Material;
      lod: RigSkinLod;
      geometries: THREE.BufferGeometry[];
      bone: number;
      castShadow: boolean;
    }
  >();
  for (const [key, owner] of Object.entries(MESH_OWNER) as [
    Exclude<keyof RigBody, "all">,
    RigJoint,
  ][]) {
    const meshes = body[key];
    const lod = MESH_LOD[key];
    const boneIndex = bones.indexOf(boneOf[owner]);
    const rest = localRest.get(owner)!;
    for (const mesh of meshes) {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(rest);
      addSkinning(geometry, boneIndex);
      const bucketKey = `${mesh.material.uuid}|${lod}`;
      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = {
          material: mesh.material,
          lod,
          geometries: [],
          bone: boneIndex,
          castShadow: mesh.castShadow,
        };
        buckets.set(bucketKey, bucket);
      }
      bucket.geometries.push(geometry);
    }
  }

  const groups: RigSkinGroup[] = [];
  for (const bucket of buckets.values()) {
    const merged =
      bucket.geometries.length === 1
        ? bucket.geometries[0]!
        : mergeGeometries(bucket.geometries, false);
    for (const geometry of bucket.geometries) {
      if (geometry !== merged) geometry.dispose();
    }
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    // esfera de culling generosa: a pose animada não sai da pose de bind
    if (merged.boundingSphere) merged.boundingSphere.radius += CULL_MARGIN;
    groups.push({
      material: bucket.material,
      geometry: merged,
      lod: bucket.lod,
      castShadow: bucket.castShadow,
      bone: bucket.bone,
    });
  }

  const all = groups.slice();
  return {
    root: boneOf.hips,
    bindMatrix,
    bones,
    skeleton,
    groups,
    all,
    boneOf,
    dispose() {
      for (const group of all) group.geometry.dispose();
      skeleton.dispose();
    },
  };
}

/** Marca todos os vértices de uma geometria como dependentes de um único osso. */
function addSkinning(geometry: THREE.BufferGeometry, boneIndex: number): void {
  const count = geometry.getAttribute("position").count;
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    skinIndex[i * 4] = boneIndex;
    skinWeight[i * 4] = 1;
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
}

/**
 * Matriz de mundo da junta na pose de bind (a mesma usada para calcular as
 * inversas dos ossos). É o que a malha mesclada aplicaria na geometria.
 */
export function rigRestMatrix(skin: RigSkin, joint: RigJoint): THREE.Matrix4 {
  const chain: RigJoint[] = [];
  let cursor: RigJoint | null = joint;
  while (cursor) {
    chain.push(cursor);
    const parent = skin.boneOf[cursor].parent as THREE.Bone | null;
    cursor = parent?.name ? (parent.name as RigJoint) : null;
  }
  const matrix = skin.bindMatrix.clone();
  for (const step of chain.reverse()) matrix.multiply(skin.boneOf[step].matrix);
  return matrix;
}

/** Conta grupos de desenho de um atleta (usado em teste de orçamento). */
export function countRigSkin(skin: RigSkin): number {
  return skin.groups.length;
}
