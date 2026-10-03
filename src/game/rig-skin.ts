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
import { handBoneSpecs, FINGER_LENGTHS, type HandJoint } from "./player-hands";
import { CORRECTIVE_DRIVERS, type CorrectiveJoint, type TwistJoint } from "./rig-correctives";
import type { PlayerMaterials } from "./player-materials";

/** Junta animada → osso. Os nomes batem com os refs de `PlayerRig`. */
export type RigJoint =
  | HandJoint
  | CorrectiveJoint
  | TwistJoint
  | "hips"
  | "spine"
  | "chest"
  | "neck"
  | "face"
  | "eyes"
  | "jaw"
  | "browL"
  | "browR"
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
  /** Stable semantic slot avoids rebuilding geometry for material-only updates. */
  materialKey?: keyof PlayerMaterials;
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

/** Rebinds cached material variants while preserving skin geometry and skeleton. */
export function rebindRigSkinMaterials(
  skin: RigSkin,
  meshes: readonly THREE.SkinnedMesh[],
  mats: PlayerMaterials,
): void {
  skin.groups.forEach((group, index) => {
    const material = group.materialKey ? mats[group.materialKey] : group.material;
    group.material = material;
    const mesh = meshes[index];
    if (mesh) mesh.material = material;
  });
}

interface JointSpec {
  joint: RigJoint;
  parent: RigJoint | null;
  /** deslocamento local, igual ao `position` do grupo no JSX */
  offset: readonly [number, number, number];
}

/** Hierarquia de juntas — precisa espelhar `PlayerRig.tsx` ponto a ponto. */
function jointSpecs(
  P: {
    hipY: number;
    hipH: number;
    spineLen: number;
    chestLen: number;
    neckLen: number;
    headR: number;
    headW: number;
    headD: number;
    shoulderW: number;
    upperArm: number;
    foreArm: number;
    hipW: number;
    thigh: number;
    shin: number;
  },
  handRadius: number,
): JointSpec[] {
  const specs: JointSpec[] = [
    { joint: "hips", parent: null, offset: [0, P.hipY, 0] },
    { joint: "spine", parent: "hips", offset: [0, P.hipH * 0.5, 0] },
    { joint: "chest", parent: "spine", offset: [0, P.spineLen, 0] },
    { joint: "neck", parent: "chest", offset: [0, P.chestLen, 0] },
    // O pivô facial coloca o centro do crânio no alto do pescoço.
    { joint: "face", parent: "neck", offset: [0, P.neckLen + P.headR * 0.82, 0] },
    // olhos: mesmo pivô do rosto; a animação só translada (movimento
    // conjugado — os dois olhos sempre juntos, como no olho real)
    { joint: "eyes", parent: "face", offset: [0, 0, 0] },
    { joint: "jaw", parent: "face", offset: [0, -P.headR * 0.18, -P.headD * 0.26] },
    { joint: "browL", parent: "face", offset: [P.headW * 0.36, P.headR * 0.31, P.headD * 0.86] },
    { joint: "browR", parent: "face", offset: [-P.headW * 0.36, P.headR * 0.31, P.headD * 0.86] },
    { joint: "blink", parent: "face", offset: [0, P.headR * 0.14, 0] },
    { joint: "clavL", parent: "chest", offset: [P.shoulderW * 0.12, P.chestLen * 0.84, 0] },
    { joint: "armL", parent: "clavL", offset: [P.shoulderW * 0.4, 0, 0] },
    { joint: "foreL", parent: "armL", offset: [0, -P.upperArm, 0] },
    { joint: "forearmTwistL", parent: "foreL", offset: [0, 0, 0] },
    { joint: "handL", parent: "foreL", offset: [0, -P.foreArm, 0] },
    { joint: "handDetailL", parent: "handL", offset: [0, 0, 0] },
    { joint: "clavR", parent: "chest", offset: [-P.shoulderW * 0.12, P.chestLen * 0.84, 0] },
    { joint: "armR", parent: "clavR", offset: [-P.shoulderW * 0.4, 0, 0] },
    { joint: "foreR", parent: "armR", offset: [0, -P.upperArm, 0] },
    { joint: "forearmTwistR", parent: "foreR", offset: [0, 0, 0] },
    { joint: "handR", parent: "foreR", offset: [0, -P.foreArm, 0] },
    { joint: "handDetailR", parent: "handR", offset: [0, 0, 0] },
    ...handBoneSpecs(handRadius),
    { joint: "legL", parent: "hips", offset: [P.hipW * 0.36, -P.hipH * 0.4, 0] },
    { joint: "kneeL", parent: "legL", offset: [0, -P.thigh, 0] },
    { joint: "ankleL", parent: "kneeL", offset: [0, -P.shin, 0] },
    { joint: "bootDetailL", parent: "ankleL", offset: [0, 0, 0] },
    { joint: "legR", parent: "hips", offset: [-P.hipW * 0.36, -P.hipH * 0.4, 0] },
    { joint: "kneeR", parent: "legR", offset: [0, -P.thigh, 0] },
    { joint: "ankleR", parent: "kneeR", offset: [0, -P.shin, 0] },
    { joint: "bootDetailR", parent: "ankleR", offset: [0, 0, 0] },
  ];
  for (const { joint, driver } of CORRECTIVE_DRIVERS) {
    const source = specs.find((spec) => spec.joint === driver)!;
    specs.push({ joint, parent: source.parent, offset: source.offset });
  }
  return specs;
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
  eyes: "eyes",
  jaw: "jaw",
  blink: "blink",
  armL: "armL",
  armR: "armR",
  foreL: "foreL",
  foreR: "foreR",
  handL: "handL",
  handR: "handR",
  handDetailL: "handDetailL",
  handDetailR: "handDetailR",
  thumbL: "thumbL",
  thumbR: "thumbR",
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
  eyes: "near",
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
  thumbL: "near",
  thumbR: "near",
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
const CULL_MARGIN = 0.6;

/**
 * Constrói o corpo em SkinnedMesh.
 *
 * @param ctx        mesmo contexto de `buildRigBody`
 * @param rootOffset posição do atleta no mundo (o grupo raiz da cena)
 */
export function buildRigSkin(
  ctx: RigBodyContext,
  rootOffset: readonly [number, number, number],
  options?: { mergeLods?: boolean },
): RigSkin {
  const body = buildRigBody(ctx);
  const specs = jointSpecs(ctx.P, ctx.handR);

  /* ------------------------------------------------------------- ossos */

  const bones: THREE.Bone[] = [];
  const boneOf = {} as Record<RigJoint, THREE.Bone>;
  for (const spec of specs) {
    const bone = new THREE.Bone();
    bone.name = spec.joint;
    bone.position.fromArray(spec.offset);
    bone.updateMatrix();
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
      materialKey?: keyof PlayerMaterials;
      lod: RigSkinLod;
      geometries: THREE.BufferGeometry[];
      bone: number;
      castShadow: boolean;
    }
  >();
  const materialKeys = new Map<THREE.Material, keyof PlayerMaterials>();
  for (const key of Object.keys(ctx.mats) as (keyof PlayerMaterials)[]) {
    materialKeys.set(ctx.mats[key], key);
  }
  for (const [key, owner] of Object.entries(MESH_OWNER) as [
    Exclude<keyof RigBody, "all">,
    RigJoint,
  ][]) {
    const meshes = body[key];
    // Cinematic actors retain every surface at a fixed detail level, so the
    // same material can share a draw across face, body and boot groups.
    const lod = options?.mergeLods ? "core" : MESH_LOD[key];
    const boneIndex = bones.indexOf(boneOf[owner]);
    const rest = localRest.get(owner)!;
    for (const mesh of meshes) {
      const geometry = mesh.geometry.clone();
      if (mesh.material === ctx.mats.skin) {
        const position = geometry.getAttribute("position");
        const authored = geometry.getAttribute("color");
        const color = authored
          ? new Float32Array(authored.array)
          : new Float32Array(position.count * 3).fill(1);
        if (key === "head" && !authored)
          for (let i = 0; i < position.count; i++) {
            const x = position.getX(i) / ctx.P.headW,
              y = position.getY(i) / ctx.P.headR,
              z = position.getZ(i) / ctx.P.headD;
            const blush =
              Math.exp(-(((Math.abs(x) - 0.52) / 0.24) ** 2) - ((y + 0.18) / 0.24) ** 2) *
              Math.max(0, z);
            color[i * 3 + 1] = color[i * 3 + 1]! * (1 - blush * 0.09);
            color[i * 3 + 2] = color[i * 3 + 2]! * (1 - blush * 0.075);
          }
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
      }
      if (mesh.material === ctx.mats.glove) {
        // Latex palm, coloured backhand and a dark wrist closure share one
        // material. Bake their albedo once, including articulated fingers.
        const positions = geometry.getAttribute("position");
        const color = new Float32Array(positions.count * 3);
        const base = (ctx.mats.glove as THREE.MeshStandardMaterial).color;
        const latex = new THREE.Color("#e0dfd7");
        for (let i = 0; i < positions.count; i++) {
          const palm = THREE.MathUtils.smoothstep(positions.getZ(i), 0, ctx.handR * 0.2);
          const cuff = /hand[LR]/.test(key)
            ? THREE.MathUtils.smoothstep(positions.getY(i), 0, ctx.handR * 0.18)
            : 0;
          color[i * 3] =
            THREE.MathUtils.lerp(1, latex.r / Math.max(0.002, base.r), palm) * (1 - cuff * 0.68);
          color[i * 3 + 1] =
            THREE.MathUtils.lerp(1, latex.g / Math.max(0.002, base.g), palm) * (1 - cuff * 0.62);
          color[i * 3 + 2] =
            THREE.MathUtils.lerp(1, latex.b / Math.max(0.002, base.b), palm) * (1 - cuff * 0.55);
        }
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
      }
      addSkinning(geometry, owner, bones, ctx, key);
      geometry.applyMatrix4(rest);
      const materialKey = materialKeys.get(mesh.material);
      const bucketKey = (materialKey ?? mesh.material.uuid) + "|" + lod;
      const bucket = buckets.get(bucketKey);
      if (bucket) {
        bucket.geometries.push(geometry);
      } else {
        buckets.set(bucketKey, {
          material: mesh.material,
          ...(materialKey !== undefined ? { materialKey } : {}),
          lod,
          geometries: [geometry],
          bone: boneIndex,
          castShadow: mesh.castShadow,
        });
      }
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
    // Small detail buckets can travel much farther than their own rest
    // radius (a glove moves from the hip to above the head). Bound the whole
    // reachable athlete around the pelvis, retaining ordinary frustum tests.
    if (merged.boundingSphere) {
      const p = ctx.P;
      const armReach =
        p.hipH * 0.5 +
        p.spineLen +
        p.chestLen +
        p.shoulderW * 0.52 +
        p.upperArm +
        p.foreArm +
        ctx.handR * 2.3;
      const legReach = p.hipH * 0.4 + p.thigh + p.shin + p.footLen + p.footH;
      const headReach =
        p.hipH * 0.5 + p.spineLen + p.chestLen + p.neckLen + p.headH + p.headR * 0.4;
      merged.boundingSphere.center.set(0, p.hipY, 0);
      merged.boundingSphere.radius = CULL_MARGIN + Math.max(armReach, legReach, headReach);
    }
    groups.push({
      material: bucket.material,
      ...(bucket.materialKey !== undefined ? { materialKey: bucket.materialKey } : {}),
      geometry: merged,
      lod: bucket.lod,
      castShadow: bucket.castShadow,
      bone: bucket.bone,
    });
  }
  // The intermediate body is cloned into the skinned buckets. Release its
  // CPU geometry too when changing appearance or promoting another athlete.
  for (const mesh of body.all) mesh.geometry.dispose();

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

/** Local blend bands keep elbows, knees and the waist continuous under
 * flexion. Face, fingers and boots retain rigid attachments. No extra draws. */
function addSkinning(
  geometry: THREE.BufferGeometry,
  owner: RigJoint,
  bones: THREE.Bone[],
  ctx: RigBodyContext,
  part: Exclude<keyof RigBody, "all">,
): void {
  const boneIndex = bones.findIndex((bone) => bone.name === owner);
  const p = ctx.P;
  const bands: Partial<
    Record<RigJoint, { other: RigJoint; y: number; width: number; below: boolean }>
  > = {
    spine: { other: "hips", y: 0, width: p.spineLen * 0.35, below: true },
    chest: { other: "spine", y: 0, width: p.chestLen * 0.3, below: true },
    armL: { other: "foreL", y: -p.upperArm, width: p.armR * 1.5, below: true },
    armR: { other: "foreR", y: -p.upperArm, width: p.armR * 1.5, below: true },
    foreL: { other: "armL", y: 0, width: p.armR * 1.5, below: false },
    foreR: { other: "armR", y: 0, width: p.armR * 1.5, below: false },
    legL: { other: "kneeL", y: -p.thigh, width: p.legR * 1.6, below: true },
    legR: { other: "kneeR", y: -p.thigh, width: p.legR * 1.6, below: true },
    kneeL: { other: "legL", y: 0, width: p.legR * 1.6, below: false },
    kneeR: { other: "legR", y: 0, width: p.legR * 1.6, below: false },
  };
  const band = bands[owner];
  const otherIndex = band ? bones.findIndex((bone) => bone.name === band.other) : boneIndex;
  const indexOf = Object.fromEntries(bones.map((bone, index) => [bone.name, index])) as Record<
    RigJoint,
    number
  >;
  const positions = geometry.getAttribute("position");
  const openingLeg = geometry.getAttribute("openingLeg");
  const count = geometry.getAttribute("position").count;
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    const distance = band ? (positions.getY(i) - band.y) * (band.below ? 1 : -1) : 1;
    const u = band ? Math.max(0, Math.min(1, (band.width - distance) / (band.width * 2))) : 0;
    const weight = u * u * (3 - 2 * u);
    skinIndex[i * 4] = boneIndex;
    skinIndex[i * 4 + 1] = otherIndex;
    skinWeight[i * 4] = 1 - weight;
    skinWeight[i * 4 + 1] = weight;
    const blendJoint = (
      proximal: RigJoint,
      distal: RigJoint,
      helper: CorrectiveJoint,
      t: number,
    ) => {
      const w = THREE.MathUtils.clamp(t, 0, 1);
      const corrective = 4 * w * (1 - w) * 0.7;
      skinIndex[i * 4] = indexOf[proximal];
      skinIndex[i * 4 + 1] = indexOf[distal];
      skinIndex[i * 4 + 2] = indexOf[helper];
      skinWeight[i * 4] = (1 - w) * (1 - corrective);
      skinWeight[i * 4 + 1] = w * (1 - corrective);
      skinWeight[i * 4 + 2] = corrective;
      skinWeight[i * 4 + 3] = 0;
    };
    if (owner === "armL" || owner === "armR") {
      const side = owner === "armL" ? "L" : "R";
      blendJoint(owner, `fore${side}`, `elbowVolume${side}`, weight);
    } else if (owner === "foreL" || owner === "foreR") {
      const side = owner === "foreL" ? "L" : "R";
      blendJoint(`arm${side}`, owner, `elbowVolume${side}`, 1 - weight);
      const wristWeight =
        1 -
        THREE.MathUtils.smoothstep(
          positions.getY(i),
          -p.foreArm - p.armR * 0.45,
          -p.foreArm + p.armR * 0.8,
        );
      if (wristWeight > 0) blendJoint(owner, `hand${side}`, `wristVolume${side}`, wristWeight);
      // Keep the elbow stationary and spread wrist rotation progressively
      // through the distal forearm. The fourth slot already exists on GPU.
      const twist = THREE.MathUtils.smoothstep(-positions.getY(i) / p.foreArm, 0.16, 0.82);
      for (let c = 0; c < 3; c++) {
        if (skinIndex[i * 4 + c] !== indexOf[owner]) continue;
        const share = skinWeight[i * 4 + c]! * twist;
        skinWeight[i * 4 + c] = skinWeight[i * 4 + c]! - share;
        skinIndex[i * 4 + 3] = indexOf[`forearmTwist${side}`];
        skinWeight[i * 4 + 3] = share;
        break;
      }
    } else if (owner === "legL" || owner === "legR") {
      const side = owner === "legL" ? "L" : "R";
      blendJoint(owner, `knee${side}`, `kneeVolume${side}`, weight);
    } else if (owner === "kneeL" || owner === "kneeR") {
      const side = owner === "kneeL" ? "L" : "R";
      blendJoint(`leg${side}`, owner, `kneeVolume${side}`, 1 - weight);
      const ankleWeight =
        1 -
        THREE.MathUtils.smoothstep(
          positions.getY(i),
          -p.shin - p.legR * 0.22,
          -p.shin + p.legR * 0.4,
        );
      if (ankleWeight > 0) blendJoint(owner, `ankle${side}`, `ankleVolume${side}`, ankleWeight);
    } else if (owner === "handL" || owner === "handR") {
      const side = owner === "handL" ? "L" : "R";
      const wristWeight =
        1 - THREE.MathUtils.smoothstep(positions.getY(i), -ctx.handR * 0.4, ctx.handR * 0.3);
      blendJoint(`forearmTwist${side}`, owner, `wristVolume${side}`, wristWeight);
    } else if (owner === "ankleL" || owner === "ankleR") {
      const side = owner === "ankleL" ? "L" : "R";
      // Only the sock/socket follows ankle flexion; the boot last stays rigid.
      if (positions.getY(i) > -p.footH * 0.15)
        blendJoint(
          `knee${side}`,
          owner,
          `ankleVolume${side}`,
          1 - THREE.MathUtils.smoothstep(positions.getY(i), -p.footH * 0.1, p.footH * 0.24),
        );
    }
    if (part === "hips" && !ctx.trousers) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      // The top stays at the waist; each opening follows its femur. The
      // centre panel divides the load gradually instead of tearing apart.
      const legWeight = 1 - THREE.MathUtils.smoothstep(y, -p.hipH * 0.85, p.hipH * 0.1);
      const opening = openingLeg?.getX(i) ?? 0;
      const left = opening
        ? opening > 0
          ? 1
          : 0
        : THREE.MathUtils.smoothstep(x, -p.hipW * 0.12, p.hipW * 0.12);
      skinIndex[i * 4 + 1] = indexOf.legL;
      skinIndex[i * 4 + 2] = indexOf.legR;
      skinWeight[i * 4] = 1 - legWeight;
      skinWeight[i * 4 + 1] = legWeight * left;
      skinWeight[i * 4 + 2] = legWeight * (1 - left);
      // Local cloth follows a single thigh except at the shared crotch.
      // Correct only the socket band; the hem retains its femur attachment.
      const socket = Math.sin(Math.PI * legWeight) ** 2 * Math.abs(left * 2 - 1) * 0.38;
      skinIndex[i * 4 + 3] = left > 0.5 ? indexOf.hipVolumeL : indexOf.hipVolumeR;
      for (let channel = 0; channel < 3; channel++)
        skinWeight[i * 4 + channel] = skinWeight[i * 4 + channel]! * (1 - socket);
      skinWeight[i * 4 + 3] = socket;
    }
    if (part === "spine") {
      // One continuous shirt spans the lumbar and chest bones. Its upper
      // rows must follow the chest, including arm raises and torso twists.
      const chestBlend = THREE.MathUtils.smoothstep(
        positions.getY(i),
        p.spineLen * 0.6,
        p.spineLen + p.chestLen * 0.2,
      );
      skinWeight[i * 4] = skinWeight[i * 4]! * (1 - chestBlend);
      skinWeight[i * 4 + 1] = skinWeight[i * 4 + 1]! * (1 - chestBlend);
      skinIndex[i * 4 + 2] = indexOf.chest;
      skinWeight[i * 4 + 2] = chestBlend;
      const shoulderBlend =
        THREE.MathUtils.smoothstep(
          positions.getY(i),
          p.spineLen + p.chestLen * 0.3,
          p.spineLen + p.chestLen * 0.8,
        ) *
        THREE.MathUtils.smoothstep(
          Math.abs(positions.getX(i)),
          p.chestW * 0.56,
          p.shoulderW * 0.49,
        ) *
        0.68;
      if (shoulderBlend > 0) {
        const side = positions.getX(i) > 0 ? "L" : "R";
        skinIndex[i * 4] = indexOf.spine;
        skinIndex[i * 4 + 1] = indexOf.chest;
        skinIndex[i * 4 + 2] = indexOf[`clav${side}`];
        skinIndex[i * 4 + 3] = indexOf[`shoulderVolume${side}`];
        skinWeight[i * 4] = (1 - chestBlend) * (1 - shoulderBlend);
        skinWeight[i * 4 + 1] = chestBlend * (1 - shoulderBlend);
        skinWeight[i * 4 + 2] = shoulderBlend * 0.22;
        skinWeight[i * 4 + 3] = shoulderBlend * 0.78;
      }
    }
    if (part === "head" || part === "hair") {
      // The sculpted chin and fitted beard share the animated jaw. No
      // duplicate chin mesh protrudes when the athlete breathes or shouts.
      const jawBlend =
        (1 - THREE.MathUtils.smoothstep(positions.getY(i), -p.headR * 0.8, -p.headR * 0.4)) *
        THREE.MathUtils.smoothstep(positions.getZ(i), -p.headD * 0.32, p.headD * 0.36);
      skinIndex[i * 4 + 1] = indexOf.jaw;
      skinWeight[i * 4] = 1 - jawBlend;
      skinWeight[i * 4 + 1] = jawBlend;
    }
    if (part === "face" && positions.getY(i) > p.headR * 0.268) {
      // Only the separate eyebrow curves occupy this upper-face band. Their
      // pivots allow effort and celebration without moving the eye sockets.
      skinIndex[i * 4] = positions.getX(i) > 0 ? indexOf.browL : indexOf.browR;
      skinWeight[i * 4] = 1;
      skinWeight[i * 4 + 1] = 0;
    }
    if (part === "armL" || part === "armR") {
      const shoulderBlend = THREE.MathUtils.smoothstep(
        positions.getY(i),
        -p.armR * 1.5,
        p.armR * 0.9,
      );
      if (shoulderBlend > 0) {
        const side = part === "armL" ? "L" : "R";
        blendJoint(`clav${side}`, `arm${side}`, `shoulderVolume${side}`, 1 - shoulderBlend * 0.65);
      }
    }
    if (part === "neck") {
      const neckWeight = THREE.MathUtils.smoothstep(positions.getY(i), 0, p.neckLen * 0.7);
      skinIndex[i * 4] = indexOf.chest;
      skinIndex[i * 4 + 1] = indexOf.neck;
      skinWeight[i * 4] = 1 - neckWeight;
      skinWeight[i * 4 + 1] = neckWeight;
      skinWeight[i * 4 + 2] = skinWeight[i * 4 + 3] = 0;
    }
    if (part === "handDetailL" || part === "handDetailR") {
      const side = part === "handDetailL" ? "L" : "R";
      const finger = Math.max(
        0,
        Math.min(3, Math.round(positions.getX(i) / (ctx.handR * 0.36) + 1.5)),
      ) as 0 | 1 | 2 | 3;
      const knuckleY = -ctx.handR * 1.29;
      const tipY = knuckleY - ctx.handR * (0.25 + FINGER_LENGTHS[finger] * 0.32);
      const tipWeight =
        1 -
        THREE.MathUtils.smoothstep(
          positions.getY(i),
          tipY - ctx.handR * 0.14,
          tipY + ctx.handR * 0.14,
        );
      const palmWeight = THREE.MathUtils.smoothstep(
        positions.getY(i),
        knuckleY - ctx.handR * 0.08,
        knuckleY + ctx.handR * 0.08,
      );
      skinIndex[i * 4] = indexOf[`finger${side}${finger}`];
      skinIndex[i * 4 + 1] = indexOf[`fingerTip${side}${finger}`];
      skinIndex[i * 4 + 2] = indexOf[`hand${side}`];
      skinWeight[i * 4] = (1 - tipWeight) * (1 - palmWeight);
      skinWeight[i * 4 + 1] = tipWeight * (1 - palmWeight);
      skinWeight[i * 4 + 2] = palmWeight;
    }
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.deleteAttribute("openingLeg");
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
