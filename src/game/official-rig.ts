import * as THREE from "three";
import { buildRigSkin, type RigJoint } from "./rig-skin";
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
  // The athlete also supplies a shared metallic boot-stud surface. It is
  // unreadable in broadcast views, so retain it with the close details.
  for (const group of skin.groups) {
    if (group.lod === "core" && !materials.some((material) => material === group.material)) {
      group.lod = "near";
    }
  }
  return { p, skin, materials };
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
