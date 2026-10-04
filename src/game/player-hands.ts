import type { PlayerAction } from "./animation";
import { footballContactAt } from "./motion-metadata";

export type HandSide = "L" | "R";
export type FingerIndex = 0 | 1 | 2 | 3;
export type HandJoint =
  `finger${HandSide}${FingerIndex}` | `fingerTip${HandSide}${FingerIndex}` | `thumb${HandSide}`;

export const FINGER_LENGTHS = [0.64, 0.84, 0.78, 0.56] as const;
export const FINGER_CENTERS_Y = [1.695, 1.79, 1.755, 1.63] as const;
export const fingerX = (index: number, radius: number) => (index - 1.5) * radius * 0.36;

interface HandBoneSpec {
  joint: HandJoint;
  parent: HandJoint | `hand${HandSide}`;
  offset: readonly [number, number, number];
}

/** The same knuckle positions author the mesh and its two joint fingers. */
export function handBoneSpecs(radius: number): HandBoneSpec[] {
  const specs: HandBoneSpec[] = [];
  for (const side of ["L", "R"] as const) {
    const sign = side === "L" ? 1 : -1;
    specs.push({
      joint: `thumb${side}`,
      parent: `hand${side}`,
      offset: [-sign * radius * 0.64, -radius * 0.6, 0],
    });
    for (const index of [0, 1, 2, 3] as const) {
      specs.push({
        joint: `finger${side}${index}`,
        parent: `hand${side}`,
        offset: [fingerX(index, radius), -radius * 1.29, radius * 0.05],
      });
      specs.push({
        joint: `fingerTip${side}${index}`,
        parent: `finger${side}${index}`,
        offset: [0, -radius * (0.25 + FINGER_LENGTHS[index] * 0.32), radius * 0.07],
      });
    }
  }
  return specs;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
const smooth = (u: number) => {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
};

export interface HandPose {
  grip: number;
  spread: number;
  wrist: number;
  pronation?: number;
  deviation?: number;
}

/** Cosmetic gestures stay independent of possession, ball physics and saves. */
export function handPoseAt(
  action: PlayerAction | null,
  progress: number,
  speed: number,
  side?: HandSide,
): HandPose & { pronation: number; deviation: number } {
  const u = clamp(progress, 0, 1);
  const effort = clamp(speed / 8, 0, 1);
  let grip = 0.16 + effort * 0.28;
  let spread = 0.018;
  let wrist = effort * 0.075;
  let pronation = 0;
  let deviation = 0;
  if (
    /^(shot|shotPower|shotPlaced|chip|volley|firstTime|pass|passLong|cross|goalKick)$/.test(
      action ?? "",
    )
  ) {
    // Striking keeps one hand as a loose counterweight and the other tighter
    // through the torso. The stable side split gives kicks and crosses a real
    // silhouette even when no dominant-foot metadata is available here.
    const swing = Math.sin(Math.PI * u);
    const counterweight = side === "L" ? 1 : 0.62;
    grip = 0.08 + (1 - counterweight) * 0.12 + effort * 0.08;
    spread = 0.035 + swing * (0.095 * counterweight + 0.035);
    wrist = (side === "L" ? -1 : 1) * swing * 0.13;
    pronation = (side === "L" ? 1 : -1) * swing * 0.16;
    deviation = (side === "L" ? 1 : -1) * swing * 0.045;
  } else if (/^(bicycle|headClear|header)$/.test(action ?? "")) {
    // Aerial actions need broad counterbalance, not the neutral running hand.
    const brace = Math.sin(Math.PI * u);
    grip = 0.09 + effort * 0.08;
    spread = 0.055 + brace * 0.1;
    wrist = (side === "L" ? -1 : 1) * brace * 0.12;
    pronation = (side === "L" ? 1 : -1) * brace * 0.14;
  } else if (/^(freeKick|corner|penalty)$/.test(action ?? "")) {
    // Set pieces read as controlled tension rather than a clenched idle fist.
    const settle = smooth((u - 0.12) / 0.3);
    grip = 0.23 + settle * 0.2;
    spread = 0.025 + (1 - settle) * 0.045;
    wrist = (side === "L" ? -1 : 1) * settle * 0.055;
    pronation = (side === "L" ? 1 : -1) * settle * 0.07;
  } else if (/^(block|intercept|duel|tackle|slide)$/.test(action ?? "")) {
    // Defenders protect the chest and face with open fingers before bracing.
    const brace = smooth((u - 0.08) / 0.24) * (1 - smooth((u - 0.75) / 0.2));
    grip = 0.16 + brace * 0.2;
    spread = 0.05 + brace * 0.1;
    wrist = (side === "L" ? -1 : 1) * brace * 0.11;
    pronation = (side === "L" ? 1 : -1) * brace * 0.1;
  } else if (/^(trap|distribute)$/.test(action ?? "")) {
    const receive = smooth((u - 0.22) / 0.22) * (1 - smooth((u - 0.7) / 0.22));
    grip = 0.12 + receive * 0.26;
    spread = 0.028 + receive * 0.075;
    wrist = (side === "L" ? -1 : 1) * receive * 0.075;
  } else if (/^(feint|cut|stepover|elastico|turn|backpedal|decelerate)$/.test(action ?? "")) {
    const balance = Math.sin(Math.PI * u);
    grip = 0.12 + effort * 0.13;
    spread = 0.03 + balance * 0.07;
    wrist = (side === "L" ? -1 : 1) * balance * 0.09;
    pronation = (side === "L" ? 1 : -1) * balance * 0.08;
  } else if (action === "throwIn") {
    const release = smooth((u - footballContactAt(action)) / 0.17);
    grip = 0.55 * (1 - release) + 0.06 * release;
    spread = 0.1 * (1 - release) + 0.04;
    wrist = -0.2 * Math.sin(Math.PI * u) + release * 0.12;
  } else if (action === "catch") {
    grip = 0.06 + 0.59 * smooth((u - 0.42) / 0.2);
    spread = 0.13 * (1 - smooth((u - 0.42) / 0.2)) + 0.015;
    wrist = -Math.sin(Math.PI * u) * 0.18;
  } else if (/^(save|saveHigh|diveLeft|diveRight)$/.test(action ?? "")) {
    const reach = smooth((u - 0.14) / 0.25) * (1 - smooth((u - 0.7) / 0.3));
    const absorb = smooth((u - footballContactAt(action!)) / 0.18) * (1 - smooth((u - 0.8) / 0.2));
    grip = 0.16 - reach * 0.11 + absorb * 0.23;
    spread = 0.025 + reach * 0.12 - absorb * 0.035;
    wrist = -reach * 0.18 + absorb * 0.12;
    pronation = reach * 0.2;
    deviation = reach * 0.06;
    if (side && (action === "diveLeft" || action === "diveRight")) {
      const leading = side === (action === "diveLeft" ? "L" : "R");
      // Broad leading palm, cupped supporting hand; the wrist yields after
      // contact instead of leaving both gloves in the same rigid gesture.
      grip += leading ? absorb * 0.05 : reach * 0.07 + absorb * 0.12;
      spread *= leading ? 1.08 : 0.76;
      wrist += leading ? -reach * 0.025 : absorb * 0.08;
      pronation += leading ? reach * 0.08 : -reach * 0.06;
      deviation *= leading ? 1 : 0.55;
    }
  } else if (/celebrate|kneeSlide|hug|protest/.test(action ?? "")) {
    const accent = side === "L" ? 1 : 0.72;
    grip = 0.56 + accent * 0.22;
    spread = 0.035 + accent * 0.045;
    wrist = (side === "L" ? -1 : 1) * 0.1;
  } else if (action === "dejected") {
    // Relaxed fingers make a dropped shoulder read as fatigue or frustration.
    grip = 0.045;
    spread = 0.012;
    wrist = (side === "L" ? 1 : -1) * 0.035;
  }
  return { grip, spread, wrist, pronation, deviation };
}

interface PoseableBone {
  rotation: { x: number; y: number; z: number };
}

/** Drive existing bones in place; this adds no meshes, materials or draws. */
export function applyHandPose(
  bones: Record<HandJoint, PoseableBone>,
  pose: HandPose,
  dt: number,
  onlySide?: HandSide,
): void {
  const k = 1 - Math.exp(-18 * clamp(dt, 0, 0.25));
  for (const side of ["L", "R"] as const) {
    if (onlySide && side !== onlySide) continue;
    const sign = side === "L" ? 1 : -1;
    for (const index of [0, 1, 2, 3] as const) {
      const base = bones[`finger${side}${index}`];
      const tip = bones[`fingerTip${side}${index}`];
      // The last two fingers remain slightly more curled in a relaxed hand.
      const curl = clamp(pose.grip + index * 0.025, 0, 0.94);
      base.rotation.x += (-curl * 1.08 - base.rotation.x) * k;
      tip.rotation.x += (-curl * 1.25 - tip.rotation.x) * k;
      base.rotation.z += ((index - 1.5) * pose.spread - base.rotation.z) * k;
    }
    const thumb = bones[`thumb${side}`];
    thumb.rotation.x += (-pose.grip * 0.55 - thumb.rotation.x) * k;
    thumb.rotation.y += (sign * pose.grip * 0.35 - thumb.rotation.y) * k;
    thumb.rotation.z += (sign * pose.grip * 0.45 - thumb.rotation.z) * k;
  }
}
