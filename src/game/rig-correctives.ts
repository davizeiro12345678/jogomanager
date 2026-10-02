import * as THREE from "three";

type Side = "L" | "R";
export type CorrectiveJoint =
  `${"shoulder" | "elbow" | "hip" | "knee" | "wrist" | "ankle"}Volume${Side}`;
type Driver = `${"arm" | "fore" | "leg" | "knee" | "hand" | "ankle"}${Side}`;
export type TwistJoint = `forearmTwist${Side}`;

/** Half-angle helper bones preserve the joint's cross-section when ordinary
 * linear skinning would collapse it. They share the existing four-weight GPU
 * skinning pass: no vertex uploads, extra surfaces or per-frame allocations. */
export const CORRECTIVE_DRIVERS: readonly {
  joint: CorrectiveJoint;
  driver: Driver;
  bulge: number;
}[] = (["L", "R"] as const).flatMap((side) => [
  { joint: `shoulderVolume${side}`, driver: `arm${side}`, bulge: 0.045 },
  { joint: `elbowVolume${side}`, driver: `fore${side}`, bulge: 0.08 },
  { joint: `hipVolume${side}`, driver: `leg${side}`, bulge: 0.055 },
  { joint: `kneeVolume${side}`, driver: `knee${side}`, bulge: 0.085 },
  { joint: `wristVolume${side}`, driver: `hand${side}`, bulge: 0.025 },
  { joint: `ankleVolume${side}`, driver: `ankle${side}`, bulge: 0.025 },
]);

const rest = new THREE.Quaternion();
const twistAxis = new THREE.Vector3(0, 1, 0);

export function updateRigCorrectives(
  bones: Record<CorrectiveJoint | Driver | TwistJoint, THREE.Bone>,
): void {
  for (const { joint, driver, bulge } of CORRECTIVE_DRIVERS) {
    const source = bones[driver];
    const helper = bones[joint];
    helper.quaternion.slerpQuaternions(rest, source.quaternion, 0.5);
    // The broad part stays small even at a full fold; the half rotation,
    // rather than a large scale, does most of the volume correction.
    const angle = source.quaternion.angleTo(rest);
    const flex = Math.min(1, angle / 2.2);
    // At the middle of a bend, 30% linear skinning loses cos(angle / 2)
    // of the radius. Compensate on the existing 70% bisector influence,
    // separately across each compressed axis. Bone length remains fixed.
    const correction = Math.min(1.38, (1 - 0.3 * Math.cos(angle * 0.5)) / 0.7) - 1;
    const q = source.quaternion;
    const axisLength = q.x * q.x + q.y * q.y + q.z * q.z;
    const axisX = axisLength > 1e-8 ? (q.x * q.x) / axisLength : 0;
    const axisZ = axisLength > 1e-8 ? (q.z * q.z) / axisLength : 0;
    const muscle = bulge * flex * flex * 0.35;
    helper.scale.set(
      1 + correction * (1 - axisX) + muscle,
      1,
      1 + correction * (1 - axisZ) + muscle,
    );
  }
  for (const side of ["L", "R"] as const) {
    const hand = bones[`hand${side}`].quaternion;
    // Swing/twist decomposition about the forearm's length. Wrist flexion
    // cannot drag the elbow: only pronation reaches this child of the ulna.
    const length = Math.hypot(hand.y, hand.w);
    const angle = length < 1e-6 ? 0 : 2 * Math.atan2(hand.y / length, hand.w / length);
    const signed = THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
    bones[`forearmTwist${side}`].quaternion.setFromAxisAngle(
      twistAxis,
      THREE.MathUtils.clamp(signed, -1.6, 1.6) * 0.82,
    );
  }
}

/** Upper body follows an aerial save instead of cancelling its line of action. */
export function spineRollForAction(roll: number, action: string | null): number {
  return -roll * (action === "diveLeft" || action === "diveRight" ? 0.14 : 0.35);
}
