import * as THREE from "three";
import { buildRigSkin, rigRestMatrix, type RigJoint } from "./rig-skin";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Pose } from "./animation-core";
import type { GroundContactResult } from "./ground-contact";
import { lookFor, lookWithPhysique, proportionsFor } from "./player-model";
import type { PlayerMaterials } from "./player-materials";
import { officialShirt, type OfficialRole } from "./official-presentation";

/** The production official keeps anatomy, planted gait and three core draws.
 * All parts use vertex colours so joint/face geometry can safely share a
 * material, including surfaces with authored skin and hair shading. */
export function buildOfficialRig(role: OfficialRole, homeColor: string, awayColor: string) {
  const look = {
    ...lookWithPhysique(lookFor(`official-${role}`, "MF"), {
      height: role === "ref" ? 181 : 177,
      weight: 74,
    }),
    hairStyle: "short" as const,
    beard: "none" as const,
    sleeves: "short" as const,
    captain: false,
    wristTape: "none" as const,
    tattoo: "none" as const,
    earring: false,
    undershirt: false,
    headband: false,
    gloves: false,
  };
  const p = proportionsFor(look);
  const shirt = new THREE.MeshStandardMaterial({
    color: officialShirt(homeColor, awayColor),
    roughness: 0.86,
    vertexColors: true,
  });
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: look.skin,
    roughness: 0.8,
    vertexColors: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#172126",
    roughness: 0.78,
    vertexColors: true,
  });
  // Material identity lets the actual skin builder merge core anatomy.
  const mats: PlayerMaterials = {
    skin: skinMaterial,
    skinDark: skinMaterial,
    jersey: shirt,
    jerseyPlain: shirt,
    shorts: dark,
    socks: dark,
    trim: dark,
    hair: dark,
    boot: dark,
    bootAccent: dark,
    sole: dark,
    glove: dark,
    shin: dark,
  };
  const skin = buildRigSkin(
    {
      P: p,
      look,
      mats,
      segs: { radial: 8, cap: 3 },
      hi: false,
      handR: p.handR,
      handMat: mats.skin,
      jerseyInk: "#152028",
    },
    [0, 0, 0],
  );
  const materials = [shirt, skinMaterial, dark];
  const attachEquipment = (
    geometry: THREE.BufferGeometry,
    joint: RigJoint,
    material: THREE.MeshStandardMaterial,
    white = false,
  ) => {
    const group = skin.groups.find((part) => part.material === material && part.lod === "core")!;
    const count = geometry.getAttribute("position").count;
    const index = new Uint16Array(count * 4);
    const weight = new Float32Array(count * 4);
    const colors = new Float32Array(count * 3).fill(1);
    for (let i = 0; i < count; i++) {
      index[i * 4] = skin.bones.indexOf(skin.boneOf[joint]);
      weight[i * 4] = 1;
      if (white) {
        // The white badge shares the shirt draw through vertex albedo.
        colors[i * 3] = 0.8 / Math.max(0.01, material.color.r);
        colors[i * 3 + 1] = 0.83 / Math.max(0.01, material.color.g);
        colors[i * 3 + 2] = 0.85 / Math.max(0.01, material.color.b);
      }
    }
    geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(index, 4));
    geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weight, 4));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.applyMatrix4(rigRestMatrix(skin, joint));
    const merged = mergeGeometries([group.geometry, geometry], false);
    if (merged) {
      group.geometry.dispose();
      group.geometry = merged;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      if (merged.boundingSphere) merged.boundingSphere.radius += 0.45;
    }
    geometry.dispose();
  };
  // Badge, chest radio, sports watch and earpiece are attached to real posed
  // bones and baked into the three existing core materials.
  attachEquipment(
    new THREE.BoxGeometry(0.056, 0.072, 0.006).translate(
      -p.chestW * 0.44,
      p.chestLen * 0.52,
      p.chestD * 0.96,
    ),
    "chest",
    shirt,
    true,
  );
  attachEquipment(
    new THREE.BoxGeometry(0.028, 0.06, 0.012).translate(
      p.chestW * 0.47,
      p.chestLen * 0.56,
      p.chestD * 0.97,
    ),
    "chest",
    dark,
  );
  attachEquipment(
    new THREE.CylinderGeometry(p.armR * 0.76, p.armR * 0.76, 0.026, 8).translate(
      0,
      -p.foreArm * 0.91,
      0,
    ),
    "foreL",
    dark,
  );
  attachEquipment(
    new THREE.SphereGeometry(0.016, 6, 4).translate(p.headW * 0.99, 0, p.headD * 0.04),
    "face",
    dark,
  );
  // The athlete also supplies a shared metallic boot-stud surface. It is
  // unreadable in broadcast views, so retain it with the close details.
  for (const group of skin.groups) {
    if (group.lod === "core" && !materials.some((material) => material === group.material)) {
      group.lod = "near";
    }
  }
  return { p, skin, materials };
}

/** Four flat coloured squares retain one flag draw and need no image decode. */
export function assistantFlagGeometry() {
  const source = new THREE.PlaneGeometry(0.26, 0.2, 2, 2);
  const geometry = source.toNonIndexed();
  source.dispose();
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  const yellow = new THREE.Color("#ffd53b"),
    orange = new THREE.Color("#ef6634");
  for (let i = 0; i < count; i++) {
    const square = Math.floor(i / 6);
    const color = square === 0 || square === 3 ? yellow : orange;
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

/** The motion catalogue stores negative knee flexion; the actual skeleton
 * bends with positive X, exactly as the ground-contact FK solver assumes. */
export function applyOfficialLegPose(
  bones: Record<RigJoint, THREE.Bone>,
  pose: Pose,
  contact: GroundContactResult,
) {
  bones.legL.rotation.set(pose.legLPitch, 0, pose.legLRoll);
  bones.legR.rotation.set(pose.legRPitch, 0, pose.legRRoll);
  bones.kneeL.rotation.x = -pose.kneeL;
  bones.kneeR.rotation.x = -pose.kneeR;
  bones.ankleL.rotation.x = THREE.MathUtils.clamp(pose.ankleL + contact.ankleLFix, -0.9, 0.9);
  bones.ankleR.rotation.x = THREE.MathUtils.clamp(pose.ankleR + contact.ankleRFix, -0.9, 0.9);
}
