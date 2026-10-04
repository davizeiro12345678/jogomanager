import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { buildRigBody, countRigBody, type RigBodyContext } from "./rig-body";
import {
  buildRigSkin,
  countRigSkin,
  MESH_OWNER,
  rebindRigSkinMaterials,
  rigRestMatrix,
} from "./rig-skin";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials, type PlayerMaterials } from "./player-materials";
import { gaitPoseAt } from "./gait-kinematics";
import { clampPoseAnatomy, solveGroundContact } from "./ground-contact";
import { eyelidRotationFor } from "./facial-animation";

const KIT = {
  base: "#0a8f3c",
  shorts: "#101418",
  socks: "#0a8f3c",
  detail: "#f5f5f2",
  pattern: "solid",
} as never;

function context(overrides: Partial<RigBodyContext> = {}): RigBodyContext {
  const look = lookFor("rig-skin-test", "MF", false);
  const mats = playerMaterials(look, KIT, null, "alta");
  return {
    P: proportionsFor(look),
    look,
    segs: { radial: 12, cap: 4 },
    hi: true,
    mats,
    jerseyInk: "#f5f5f2",
    handR: proportionsFor(look).handR,
    handMat: mats.skin,
    ...overrides,
  };
}

const ROOT: [number, number, number] = [12.5, 0, -7.25];

/**
 * Atualiza o esqueleto como o renderizador faria: o osso raiz é filho do grupo
 * que posiciona o atleta (por isso a translação entra nas matrizes de mundo) e
 * a malha é irmã desse osso, debaixo do mesmo grupo.
 */
function update(skin: ReturnType<typeof buildRigSkin>, pose?: () => void) {
  if (pose) pose();
  const host = new THREE.Object3D();
  host.position.set(...ROOT);
  host.add(skin.root);
  host.updateMatrixWorld(true);
  skin.skeleton.update();
}

/** Matrizes de osso atuais (o three.js as guarda num Float32Array). */
function boneMatrices(skin: ReturnType<typeof buildRigSkin>): Float32Array {
  const matrices = skin.skeleton.boneMatrices;
  if (!matrices) throw new Error("esqueleto sem matrizes");
  return matrices;
}

/** Posições finitas de todos os vértices de um grupo. */
function vertices(geometry: THREE.BufferGeometry): number[] {
  return Array.from(geometry.getAttribute("position").array);
}

describe("rig skin", () => {
  it("rebinds surface materials without replacing geometry or the skeleton", () => {
    const ctx = context();
    const skin = buildRigSkin(ctx, ROOT);
    const meshes = skin.groups.map((group) => {
      const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
      mesh.skeleton = skin.skeleton;
      return mesh;
    });
    const geometryBefore = meshes.map((mesh) => mesh.geometry);
    const rebound = Object.fromEntries(
      Object.entries(ctx.mats).map(([key, material]) => [key, material.clone()]),
    ) as PlayerMaterials;

    rebindRigSkinMaterials(skin, meshes, rebound);

    skin.groups.forEach((group, index) => {
      expect(meshes[index]!.geometry).toBe(geometryBefore[index]);
      expect(meshes[index]!.skeleton).toBe(skin.skeleton);
      expect(meshes[index]!.material).toBe(
        group.materialKey ? rebound[group.materialKey] : group.material,
      );
    });
    skin.dispose();
    Object.values(rebound).forEach((material) => material.dispose());
  });

  it("batches cinematic LOD groups without losing vertices or changing skinning", () => {
    const ctx = context();
    const original = buildRigSkin(ctx, ROOT);
    const cinema = buildRigSkin(ctx, ROOT, { mergeLods: true });
    const vertexCount = (skin: typeof original) =>
      skin.groups.reduce(
        (count, group) => count + group.geometry.getAttribute("position").count,
        0,
      );
    expect(vertexCount(cinema)).toBe(vertexCount(original));
    expect(cinema.groups.length).toBeLessThan(original.groups.length);
    expect(cinema.bones.map((bone) => bone.name)).toEqual(original.bones.map((bone) => bone.name));
    const attributes = (skin: typeof original) =>
      skin.groups
        .flatMap((group) => {
          const position = group.geometry.getAttribute("position");
          const indices = group.geometry.getAttribute("skinIndex");
          const weights = group.geometry.getAttribute("skinWeight");
          return Array.from({ length: position.count }, (_, i) =>
            [
              position.getX(i),
              position.getY(i),
              position.getZ(i),
              indices.getX(i),
              indices.getY(i),
              weights.getX(i),
              weights.getY(i),
            ].join("|"),
          );
        })
        .sort();
    expect(attributes(cinema)).toEqual(attributes(original));
    original.dispose();
    cinema.dispose();
  });
  it("plants the final sole using the actual Three skeleton after root and pelvis lean", () => {
    const ctx = context();
    const skin = buildRigSkin(ctx, ROOT);
    const host = new THREE.Object3D();
    host.add(skin.root);
    const { P } = ctx;
    for (let frame = 0; frame < 16; frame++) {
      const pose = clampPoseAnatomy(gaitPoseAt((frame / 16) * Math.PI * 2, 4.5, P).pose);
      const input = {
        P,
        pose,
        hipShiftX: 0.025,
        hipRollOffset: 0.03,
        leanX: 0.1,
        leanZ: 0.16,
        airborne: 0,
        previousRootY: 0,
        dt: 1 / 60,
      };
      const ground = solveGroundContact(input);
      host.position.set(0, ground.rootY, 0);
      host.rotation.set(input.leanX, 1.3, input.leanZ, "YXZ");
      skin.boneOf.hips.position.set(input.hipShiftX, P.hipY + pose.hipY, 0);
      skin.boneOf.hips.rotation.set(pose.hipPitch, pose.hipYaw, pose.hipRoll + input.hipRollOffset);
      skin.boneOf.legL.rotation.set(pose.legLPitch, 0, pose.legLRoll);
      skin.boneOf.legR.rotation.set(pose.legRPitch, 0, pose.legRRoll);
      skin.boneOf.kneeL.rotation.x = -pose.kneeL;
      skin.boneOf.kneeR.rotation.x = -pose.kneeR;
      skin.boneOf.ankleL.rotation.x = Math.max(-0.9, Math.min(0.9, pose.ankleL + ground.ankleLFix));
      skin.boneOf.ankleR.rotation.x = Math.max(-0.9, Math.min(0.9, pose.ankleR + ground.ankleRFix));
      host.updateMatrixWorld(true);
      const heights = [skin.boneOf.ankleL, skin.boneOf.ankleR].flatMap((ankle) =>
        [-P.footLen * 0.33, P.footLen * 0.53].map(
          (z) => new THREE.Vector3(0, -P.footH * 0.7, z).applyMatrix4(ankle.matrixWorld).y,
        ),
      );
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(0.0079);
    }
  });

  it("renders the athlete in a fraction of the merged-mesh draws", () => {
    const skin = buildRigSkin(context(), ROOT);
    const meshes = countRigBody(buildRigBody(context()));
    // 53 malhas mescladas → ~18 grupos de material
    expect(countRigSkin(skin)).toBeLessThanOrEqual(20);
    expect(countRigSkin(skin)).toBeLessThan(meshes / 2);
    // e sempre sobra pelo menos um grupo de cada nível de LOD
    expect(skin.groups.some((group) => group.lod === "core")).toBe(true);
    expect(skin.groups.some((group) => group.lod === "near")).toBe(true);
  });

  it("binds in the rest pose, so the silhouette is unchanged", () => {
    const skin = buildRigSkin(context(), ROOT);
    update(skin);
    const matrices = boneMatrices(skin);
    for (let i = 0; i < skin.bones.length; i += 1) {
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 4; col++)
          expect(matrices[i * 16 + row * 4 + col]).toBeCloseTo(row === col ? 1 : 0, 5);
    }
  });

  it("mirrors the joint hierarchy with the same pivots", () => {
    const skin = buildRigSkin(context(), ROOT);
    expect(skin.boneOf.hips.parent).toBeNull();
    expect(skin.boneOf.spine.parent).toBe(skin.boneOf.hips);
    expect(skin.boneOf.chest.parent).toBe(skin.boneOf.spine);
    expect(skin.boneOf.neck.parent).toBe(skin.boneOf.chest);
    expect(skin.boneOf.legL.parent).toBe(skin.boneOf.hips);
    expect(skin.boneOf.kneeL.parent).toBe(skin.boneOf.legL);
    expect(skin.boneOf.ankleL.parent).toBe(skin.boneOf.kneeL);
    expect(skin.boneOf.armL.parent).toBe(skin.boneOf.clavL);
    expect(skin.boneOf.clavL.parent).toBe(skin.boneOf.chest);
    // espelho direito com o sinal trocado
    expect(skin.boneOf.armR.position.x).toBeCloseTo(-skin.boneOf.armL.position.x, 6);
    expect(skin.boneOf.legR.position.x).toBeCloseTo(-skin.boneOf.legL.position.x, 6);
    // pivô do quadril na altura do quadril, não no chão
    expect(skin.boneOf.hips.position.y).toBeGreaterThan(0.5);
    expect(skin.boneOf.hips.position.y).toBeLessThan(1.4);
  });

  it("replaces the blink scale bone with four articulated orbital hinges", () => {
    const skin = buildRigSkin(context(), ROOT);
    const eyelids = ["eyelidUpperL", "eyelidLowerL", "eyelidUpperR", "eyelidLowerR"];

    expect(skin.bones).toHaveLength(63);
    expect(skin.bones.map((bone) => bone.name)).not.toContain("blink");
    expect(
      Object.keys(MESH_OWNER)
        .filter((part) => part.startsWith("eyelid"))
        .sort(),
    ).toEqual(eyelids.slice().sort());
    for (const joint of eyelids) {
      const bone = skin.bones.find((candidate) => candidate.name === joint);
      expect(bone).toBeDefined();
      expect(bone!.parent).toBe(skin.boneOf.face);
      expect(bone!.position.z).toBeGreaterThan(0);
    }
    const upperL = skin.bones.find((bone) => bone.name === "eyelidUpperL")!;
    const lowerL = skin.bones.find((bone) => bone.name === "eyelidLowerL")!;
    const upperR = skin.bones.find((bone) => bone.name === "eyelidUpperR")!;
    const lowerR = skin.bones.find((bone) => bone.name === "eyelidLowerR")!;
    expect(upperL.position.x).toBeGreaterThan(0);
    expect(lowerL.position.x).toBeGreaterThan(0);
    expect(upperR.position.x).toBeLessThan(0);
    expect(lowerR.position.x).toBeLessThan(0);
    expect(upperL.position.y).toBeGreaterThan(lowerL.position.y);
    expect(upperR.position.y).toBeGreaterThan(lowerR.position.y);
    skin.dispose();
  });

  it("keeps each orbital hinge fixed while its own free eyelid edge rotates", () => {
    const skin = buildRigSkin(context(), ROOT);
    const meshes = skin.groups.map((group) => {
      const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
      mesh.skeleton = skin.skeleton;
      mesh.bindMatrix.copy(skin.bindMatrix);
      mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
      return mesh;
    });
    const rootOffset = new THREE.Vector3(...ROOT);
    const probeFor = (joint: "eyelidUpperL" | "eyelidLowerL", upper: boolean) => {
      const bone = skin.boneOf[joint];
      const index = skin.bones.indexOf(bone);
      const pivot = new THREE.Vector3()
        .setFromMatrixPosition(rigRestMatrix(skin, joint))
        .sub(rootOffset);
      let candidate:
        | { mesh: THREE.SkinnedMesh; index: number; point: THREE.Vector3; distance: number }
        | undefined;
      for (const mesh of meshes) {
        const positions = mesh.geometry.getAttribute("position");
        const skinIndex = mesh.geometry.getAttribute("skinIndex");
        const weights = mesh.geometry.getAttribute("skinWeight");
        for (let vertex = 0; vertex < positions.count; vertex++) {
          if (skinIndex.getX(vertex) !== index || weights.getX(vertex) < 0.999) continue;
          const point = new THREE.Vector3().fromBufferAttribute(positions, vertex);
          const distance = point.y - pivot.y;
          if (!candidate || (upper ? distance < candidate.distance : distance > candidate.distance))
            candidate = { mesh, index: vertex, point, distance };
        }
      }
      expect(candidate).toBeDefined();
      return { bone, pivot, probe: candidate! };
    };

    update(skin);
    const upper = probeFor("eyelidUpperL", true);
    const lower = probeFor("eyelidLowerL", false);
    const upperHinge = upper.bone.getWorldPosition(new THREE.Vector3()).clone();
    const lowerHinge = lower.bone.getWorldPosition(new THREE.Vector3()).clone();
    upper.bone.rotation.x = eyelidRotationFor(1, true);
    lower.bone.rotation.x = eyelidRotationFor(1, false);
    update(skin);

    expect(upper.bone.getWorldPosition(new THREE.Vector3()).distanceTo(upperHinge)).toBeLessThan(
      1e-7,
    );
    expect(lower.bone.getWorldPosition(new THREE.Vector3()).distanceTo(lowerHinge)).toBeLessThan(
      1e-7,
    );
    const transformedUpper = upper.probe.point.clone();
    const transformedLower = lower.probe.point.clone();
    upper.probe.mesh.applyBoneTransform(upper.probe.index, transformedUpper);
    lower.probe.mesh.applyBoneTransform(lower.probe.index, transformedLower);
    expect(transformedUpper.distanceTo(upper.probe.point)).toBeGreaterThan(0.002);
    expect(transformedLower.distanceTo(lower.probe.point)).toBeGreaterThan(0.001);
    skin.dispose();
  });

  it("normalizes every skin weight and blends vertices across joint boundaries", () => {
    const skin = buildRigSkin(context(), ROOT);
    let blended = 0;
    for (const group of skin.groups) {
      const skinIndex = group.geometry.getAttribute("skinIndex");
      const skinWeight = group.geometry.getAttribute("skinWeight");
      expect(skinIndex).toBeTruthy();
      expect(skinWeight).toBeTruthy();
      for (let i = 0; i < skinIndex.count; i += 1) {
        const weight =
          skinWeight.getX(i) + skinWeight.getY(i) + skinWeight.getZ(i) + skinWeight.getW(i);
        expect(weight).toBeCloseTo(1, 5);
        expect(skinIndex.getX(i)).toBeLessThan(skin.bones.length);
        if (skinWeight.getY(i) > 0 && skinWeight.getX(i) > 0) blended++;
      }
    }
    expect(blended).toBeGreaterThan(100);
  });

  it("deforms only the vertices of the rotated joint", () => {
    const skin = buildRigSkin(context(), ROOT);
    const rest = skin.groups.map((group) => vertices(group.geometry));

    update(skin);
    const before = boneMatrices(skin).slice();

    // gira o joelho esquerdo: só o que está abaixo dele pode sair do lugar
    update(skin, () => skin.boneOf.kneeL.rotation.set(0.9, 0, 0));
    const after = boneMatrices(skin).slice();
    const moved = skin.bones.map(
      (_, i) =>
        Math.abs(after[i * 16]! - before[i * 16]!) +
        Math.abs(after[i * 16 + 13]! - before[i * 16 + 13]!),
    );

    const kneeIndex = skin.bones.indexOf(skin.boneOf.kneeL);
    expect(moved[kneeIndex]).toBeGreaterThan(0.05);
    // o quadril e o peito não se movem
    expect(moved[skin.bones.indexOf(skin.boneOf.hips)]).toBeCloseTo(0, 6);
    expect(moved[skin.bones.indexOf(skin.boneOf.chest)]).toBeCloseTo(0, 6);
    // a geometria em si não muda: quem deforma é o osso
    skin.groups.forEach((group, index) => {
      expect(vertices(group.geometry)).toEqual(rest[index]);
    });
  });

  it("keeps the same total geometry as the merged mesh rig", () => {
    const skin = buildRigSkin(context(), ROOT);
    const body = buildRigBody(context());
    const skinned = skin.groups.reduce(
      (sum, group) => sum + group.geometry.getAttribute("position").count,
      0,
    );
    const merged = body.all.reduce(
      (sum, mesh) => sum + mesh.geometry.getAttribute("position").count,
      0,
    );
    expect(skinned).toBe(merged);
  });

  it("leaves room for six heroes inside the high tier budget", () => {
    const skin = buildRigSkin(context(), ROOT);
    // orçamento Alto = 260 desenhos; só o corpo entra no mapa de sombras
    const perHero = countRigSkin(skin) + skin.groups.filter((g) => g.lod === "core").length;
    expect(perHero * 6).toBeLessThanOrEqual(260);
  });

  it("lands every vertex exactly where the merged-mesh rig lands it", () => {
    const skin = buildRigSkin(context(), ROOT);
    const body = buildRigBody(context());
    update(skin);
    const matrices = boneMatrices(skin);

    // --- caminho da GPU: world = meshWorld * bindInverse * boneMat * bind * pos
    const meshWorld = new THREE.Matrix4().makeTranslation(...ROOT);
    const bindInverse = skin.bindMatrix.clone().invert();
    const boneMatrix = new THREE.Matrix4();
    const world = new THREE.Matrix4();
    const vertex = new THREE.Vector3();
    const skinnedPoints: number[] = [];
    for (const group of skin.groups) {
      const position = group.geometry.getAttribute("position");
      const skinIndex = group.geometry.getAttribute("skinIndex");
      for (let i = 0; i < position.count; i += 1) {
        boneMatrix.fromArray(matrices, skinIndex.getX(i) * 16);
        world.copy(meshWorld).multiply(bindInverse).multiply(boneMatrix).multiply(skin.bindMatrix);
        vertex.fromBufferAttribute(position, i).applyMatrix4(world);
        skinnedPoints.push(vertex.x, vertex.y, vertex.z);
      }
    }

    // --- caminho da malha mesclada: world = raiz * cadeia de juntas * posição local
    const mergedPoints: number[] = [];
    for (const key of Object.keys(MESH_OWNER) as (keyof typeof MESH_OWNER)[]) {
      const rest = rigRestMatrix(skin, MESH_OWNER[key]);
      for (const mesh of body[key]) {
        const position = mesh.geometry.getAttribute("position");
        for (let i = 0; i < position.count; i += 1) {
          vertex.fromBufferAttribute(position, i).applyMatrix4(rest);
          mergedPoints.push(vertex.x, vertex.y, vertex.z);
        }
      }
    }

    skinnedPoints.sort((a, b) => a - b);
    mergedPoints.sort((a, b) => a - b);
    expect(skinnedPoints.length).toBe(mergedPoints.length);
    let worst = 0;
    for (let i = 0; i < skinnedPoints.length; i += 1) {
      worst = Math.max(worst, Math.abs(skinnedPoints[i]! - mergedPoints[i]!));
    }
    // mesma silhueta, mesmo lugar: o port não move um único vértice
    expect(worst).toBeLessThan(0.0001);
  });
});
