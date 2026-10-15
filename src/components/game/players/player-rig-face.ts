/** Presentation-only facial animation for a skinned footballer.
 * Receives already validated, deterministic rendering inputs. Never writes
 * match outcomes, user state or persistent saves.
 */
import * as THREE from "three";
import { expressionFor } from "@/game/animation-extra3";
import { eyelidRotationFor, facialPoseAt, type FacialPose } from "@/game/facial-animation";
import type { ClipName } from "@/game/animation";
import type { RigSkin } from "@/game/rig-skin";
import type { Proportions } from "@/game/player-model";
import type { FaceMorphology } from "@/game/player-morphology";

export interface FacialPresentation {
  speed: number;
  tired: number;
  previewAt?: number;
  t: number;
  lookSeed: number;
  seed: number;
  clip: ClipName;
  gaze: number;
  gazePitch: number;
  adt: number;
  skin: RigSkin;
  P: Proportions;
  facialShape: FaceMorphology;
  facialBuffer: FacialPose;
  jaw: THREE.Bone | null;
  eyes: THREE.Bone | null;
  upperLeft: THREE.Bone | null;
  upperRight: THREE.Bone | null;
  lowerLeft: THREE.Bone | null;
  lowerRight: THREE.Bone | null;
}
export function applyRigFacialPresentation({
  speed,
  tired,
  previewAt,
  t,
  lookSeed,
  seed,
  clip,
  gaze,
  gazePitch,
  adt,
  skin,
  P,
  facialShape,
  facialBuffer,
  jaw,
  eyes,
  upperLeft,
  upperRight,
  lowerLeft,
  lowerRight,
}: FacialPresentation): void {
  const effort = Math.min(1, speed / 7);
  const expr = expressionFor(clip, effort, tired);
  const facePose = facialPoseAt(t, lookSeed, expr, gaze, gazePitch, effort, facialBuffer);
  const faceResponse = previewAt !== undefined ? 1 : 1 - Math.exp(-18 * adt);
  const celebrating = /celebrat|fist|victory|applaud|hug/i.test(clip);
  const protesting = /protest|argue|complain/i.test(clip);
  // The head bone carries the large tracking pose.  A much smaller facial
  // layer adds breathing, concentration and reaction tension without
  // changing the skeleton, simulation state or any draw budget.
  const faceBone = skin.boneOf.face;
  const facialBreath = Math.sin(t * (2.1 + effort) + seed);
  const facePitch =
    tired * 0.018 + effort * 0.006 + (protesting ? -0.01 : 0) + facialBreath * 0.0035;
  const faceYaw = gaze * (celebrating ? 0.024 : 0.012) + facialBreath * 0.002;
  const faceRoll = (celebrating ? -0.008 : protesting ? 0.008 : 0) + facialBreath * 0.0025;
  faceBone.rotation.x += (facePitch - faceBone.rotation.x) * faceResponse;
  faceBone.rotation.y += (faceYaw - faceBone.rotation.y) * faceResponse;
  faceBone.rotation.z += (faceRoll - faceBone.rotation.z) * faceResponse;
  const browLift =
    P.headR * (celebrating ? 0.035 : protesting ? -0.012 : -effort * 0.01 - tired * 0.006);
  const browTilt = celebrating ? -0.035 : protesting ? 0.12 : effort * 0.06;
  for (const side of ["L", "R"] as const) {
    const brow = side === "L" ? skin.boneOf.browL : skin.boneOf.browR;
    const response = previewAt !== undefined ? 1 : 1 - Math.exp(-12 * adt);
    const sideSign = side === "L" ? 1 : -1;
    brow.position.y +=
      (P.headR * (0.31 + facialShape.browAsymmetry * sideSign) + browLift - brow.position.y) *
      response;
    brow.rotation.z += ((side === "L" ? 1 : -1) * browTilt - brow.rotation.z) * response;
  }
  // Jaw, orbital hinges and saccades share the match clock and freeze with the pose.
  if (jaw) {
    const vocalTension = celebrating ? 0.035 : protesting ? 0.024 : effort * 0.008;
    jaw.rotation.x += (Math.min(0.33, facePose.jaw + vocalTension) - jaw.rotation.x) * faceResponse;
  }
  if (eyes) {
    eyes.position.x += (facePose.eyeX * P.headR * 0.055 - eyes.position.x) * faceResponse;
    eyes.position.y += (facePose.eyeY * P.headR * 0.045 - eyes.position.y) * faceResponse;
    // The eye group is still a single bone, but a few degrees around the
    // face centre lets the iris, pupil and new catchlight scan together.
    eyes.rotation.y += (facePose.eyeX * 0.028 - eyes.rotation.y) * faceResponse;
    eyes.rotation.x += (-facePose.eyeY * 0.02 - eyes.rotation.x) * faceResponse;
  }
  const exertionSquint = Math.min(0.1, effort * 0.045 + (protesting ? 0.025 : 0));
  const lidClosure = Math.min(1, facePose.lidClosure + exertionSquint);
  const upperLidRotation = eyelidRotationFor(lidClosure, true);
  const lowerLidRotation = eyelidRotationFor(lidClosure, false);
  for (const lid of [upperLeft, upperRight])
    if (lid) lid.rotation.x += (upperLidRotation - lid.rotation.x) * faceResponse;
  for (const lid of [lowerLeft, lowerRight])
    if (lid) lid.rotation.x += (lowerLidRotation - lid.rotation.x) * faceResponse;
}
