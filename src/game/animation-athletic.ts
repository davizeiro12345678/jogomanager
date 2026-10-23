import { emptyPose, type Clip, type ClipCtx } from "./animation-core";

/** Off-ball preparation and recovery. These poses change presentation only;
 * ball contacts and match decisions remain owned by the sequential Worker. */
function ready(c: ClipCtx, intensity: number) {
  const p = emptyPose();
  const breath = Math.sin(c.t * 1.8 + c.seed);
  p.hipPitch = 0.045 * intensity;
  p.spine = 0.06 * intensity + breath * 0.006;
  p.legLPitch = p.legRPitch = -0.12 * intensity;
  p.kneeL = p.kneeR = -0.24 * intensity;
  p.ankleL = p.ankleR = 0.1 * intensity;
  p.legLRoll = 0.06 * intensity;
  p.legRRoll = -0.06 * intensity;
  p.armLRoll = 0.13 + intensity * 0.08;
  p.armRRoll = -p.armLRoll;
  p.elbowL = p.elbowR = -0.32 - intensity * 0.12;
  p.headPitch = -0.04 * intensity;
  return p;
}

export const ATHLETIC_CLIPS = {
  thoracicRotation: ((c) => {
    const p = ready(c, 0.2);
    const turn = Math.sin(c.t * 1.1 + c.seed * 0.11);
    p.hipYaw = -turn * 0.055;
    p.chest = turn * 0.22;
    p.headYaw = turn * 0.31;
    p.armLPitch = -0.18 - turn * 0.12;
    p.armRPitch = -0.18 + turn * 0.12;
    p.elbowL = p.elbowR = -0.52;
    return p;
  }) satisfies Clip,
  anklePushOff: ((c) => {
    const p = ready(c, 0.25);
    const cycle = c.t * 2.5 + c.seed * 0.1;
    const left = Math.max(0, Math.sin(cycle)),
      right = Math.max(0, -Math.sin(cycle));
    p.ankleL = -left * 0.34;
    p.ankleR = -right * 0.34;
    p.kneeL -= left * 0.18;
    p.kneeR -= right * 0.18;
    p.hipY = (left + right) * 0.017;
    p.hipRoll = (right - left) * 0.035;
    p.armLPitch = (left - right) * 0.12;
    p.armRPitch = -p.armLPitch;
    return p;
  }) satisfies Clip,
  hipPivotLeft: ((c) => pivot(c, 1)) satisfies Clip,
  hipPivotRight: ((c) => pivot(c, -1)) satisfies Clip,
  keeperReach: ((c) => {
    const p = ready(c, 0.9);
    const turn = Math.sin(c.t * 1.6 + c.seed * 0.13);
    p.hipRoll = turn * 0.075;
    p.armLRoll = 0.32 + Math.max(0, turn) * 0.43;
    p.armRRoll = -0.32 - Math.max(0, -turn) * 0.43;
    p.armLPitch = p.armRPitch = -0.38;
    p.elbowL = -0.5 + Math.max(0, turn) * 0.28;
    p.elbowR = -0.5 + Math.max(0, -turn) * 0.28;
    p.kneeL -= Math.max(0, turn) * 0.18;
    p.kneeR -= Math.max(0, -turn) * 0.18;
    p.headYaw = turn * 0.18;
    return p;
  }) satisfies Clip,
  landingSettle: ((c) => {
    const p = ready(c, 0.2);
    const cycle = c.t * 2.2 + c.seed * 0.07;
    const load = ((1 - Math.cos(cycle)) * 0.5) ** 2;
    p.hipY = -load * 0.05;
    p.hipPitch = load * 0.055;
    p.spine += load * 0.08;
    p.legLPitch = p.legRPitch = -0.055 - load * 0.2;
    p.kneeL = p.kneeR = -0.1 - load * 0.4;
    p.ankleL = p.ankleR = 0.05 + load * 0.17;
    p.armLPitch = p.armRPitch = -load * 0.24;
    p.armLRoll += load * 0.14;
    p.armRRoll -= load * 0.14;
    p.headPitch = -load * 0.04;
    return p;
  }) satisfies Clip,
  splitStep: ((c) => {
    const p = ready(c, 0.65);
    const cycle = c.t * 4.6 + c.seed * 0.13;
    const load = (1 - Math.cos(cycle)) * 0.5;
    p.hipY = Math.max(0, Math.sin(cycle)) * 0.025;
    p.kneeL -= load * 0.23;
    p.kneeR -= load * 0.23;
    p.ankleL = p.ankleR = 0.08 + load * 0.07;
    p.armLPitch = -0.12 - load * 0.06;
    p.armRPitch = p.armLPitch;
    return p;
  }) satisfies Clip,
  kneeDrive: ((c) => {
    const p = ready(c, 0.2);
    const step = Math.sin(c.t * 3.4 + c.seed * 0.17);
    const left = Math.max(0, step),
      right = Math.max(0, -step);
    p.legLPitch = -left * 0.9;
    p.legRPitch = -right * 0.9;
    p.kneeL = -0.15 - left * 0.95;
    p.kneeR = -0.15 - right * 0.95;
    p.armLPitch = step * 0.38;
    p.armRPitch = -step * 0.38;
    p.hipRoll = -step * 0.035;
    p.chest = step * 0.055;
    return p;
  }) satisfies Clip,
  heelRecovery: ((c) => {
    const p = ready(c, 0.18);
    const step = Math.sin(c.t * 4 + c.seed * 0.19);
    p.kneeL = -0.15 - Math.max(0, step) * 1.35;
    p.kneeR = -0.15 - Math.max(0, -step) * 1.35;
    p.legLPitch = Math.max(0, step) * 0.12;
    p.legRPitch = Math.max(0, -step) * 0.12;
    p.armLPitch = step * 0.21;
    p.armRPitch = -step * 0.21;
    p.hipY = Math.abs(step) * 0.012;
    return p;
  }) satisfies Clip,
  lateralReach: ((c) => {
    const p = ready(c, 0.5);
    const shift = Math.sin(c.t * 1.3 + c.seed * 0.11);
    p.hipRoll = shift * 0.11;
    p.legLRoll = 0.18 + Math.max(0, shift) * 0.11;
    p.legRRoll = -0.18 - Math.max(0, -shift) * 0.11;
    p.kneeL -= Math.max(0, shift) * 0.42;
    p.kneeR -= Math.max(0, -shift) * 0.42;
    p.armLRoll += Math.max(0, -shift) * 0.32;
    p.armRRoll -= Math.max(0, shift) * 0.32;
    p.headYaw = -shift * 0.17;
    return p;
  }) satisfies Clip,
  hipOpen: ((c) => {
    const p = ready(c, 0.15);
    const cycle = c.t * 1.8 + c.seed * 0.09;
    const lift = (1 - Math.cos(cycle)) * 0.5;
    p.legLPitch = -lift * 0.62;
    p.legLRoll = 0.05 + lift * (0.24 + Math.sin(cycle) * 0.09);
    p.kneeL = -0.12 - lift * 0.95;
    p.ankleL = lift * 0.1;
    p.hipYaw = -lift * 0.07;
    p.armRRoll -= lift * 0.18;
    return p;
  }) satisfies Clip,
  captainSignal: ((c) => {
    const p = ready(c, 0.3);
    const gesture = (1 - Math.cos(c.t * 1.4 + c.seed * 0.1)) * 0.5;
    p.armLPitch = -0.16 - gesture * 0.62;
    p.armLRoll = 0.18 + gesture * 0.61;
    p.elbowL = -0.2 - gesture * 0.2;
    p.headYaw = gesture * 0.26;
    p.chest = gesture * 0.065;
    return p;
  }) satisfies Clip,
  keeperShuffle: ((c) => {
    const p = ready(c, 1.1);
    const step = Math.sin(c.t * 3.1 + c.seed * 0.1);
    p.legLRoll = 0.19 + Math.max(0, step) * 0.08;
    p.legRRoll = -0.19 - Math.max(0, -step) * 0.08;
    p.kneeL -= Math.max(0, -step) * 0.2;
    p.kneeR -= Math.max(0, step) * 0.2;
    p.hipRoll = step * 0.035;
    p.armLPitch = p.armRPitch = -0.25;
    p.elbowL = p.elbowR = -0.7;
    return p;
  }) satisfies Clip,
  calfRaise: ((c) => {
    const p = ready(c, 0.1);
    const lift = (1 - Math.cos(c.t * 2.1 + c.seed * 0.1)) * 0.5;
    p.hipY = lift * 0.025;
    p.ankleL = p.ankleR = -lift * 0.28;
    p.kneeL = p.kneeR = -0.03;
    p.armLRoll += lift * 0.07;
    p.armRRoll -= lift * 0.07;
    return p;
  }) satisfies Clip,
  readyPress: ((c) => {
    const p = ready(c, 1);
    const shift = Math.sin(c.t * 2.8 + c.seed);
    p.hipRoll = shift * 0.035;
    p.kneeL -= Math.max(0, shift) * 0.13;
    p.kneeR -= Math.max(0, -shift) * 0.13;
    p.headYaw = Math.sin(c.t * 0.7) * 0.14;
    return p;
  }) satisfies Clip,
  receiveScan: ((c) => {
    const p = ready(c, 0.4);
    const scan = Math.sin(c.t * 1.05 + c.seed);
    p.headYaw = scan * 0.48;
    p.hipYaw = scan * 0.035;
    p.chest = scan * 0.045;
    p.armLPitch = -0.08;
    p.armRPitch = 0.06;
    return p;
  }) satisfies Clip,
  keeperSettle: ((c) => {
    const pulse = (1 - Math.cos(c.t * 4.1)) * 0.5;
    const p = ready(c, 0.75 + pulse * 0.6);
    p.armLPitch = p.armRPitch = -0.24 - pulse * 0.06;
    p.elbowL = p.elbowR = -0.75;
    p.legLRoll = 0.16;
    p.legRRoll = -0.16;
    return p;
  }) satisfies Clip,
  balanceRecover: ((c) => {
    const p = ready(c, 0.35);
    const sway = Math.sin(c.t * 1.7 + c.seed);
    p.hipRoll = sway * 0.075;
    p.spine -= sway * 0.045;
    p.armLRoll += Math.max(0, -sway) * 0.24;
    p.armRRoll -= Math.max(0, sway) * 0.24;
    p.kneeL -= Math.max(0, sway) * 0.22;
    p.kneeR -= Math.max(0, -sway) * 0.22;
    return p;
  }) satisfies Clip,
  shoulderRelease: ((c) => {
    const p = ready(c, 0.1);
    const roll = Math.sin(c.t * 1.9);
    p.armLPitch = roll * 0.32;
    p.armRPitch = -roll * 0.32;
    p.chest = Math.sin(c.t * 1.9 - 0.4) * 0.075;
    p.headYaw = -roll * 0.09;
    p.elbowL = p.elbowR = -0.28;
    return p;
  }) satisfies Clip,
  ankleMobilise: ((c) => {
    const p = ready(c, 0.15);
    const lift = (1 - Math.cos(c.t * 1.6)) * 0.5;
    p.legLPitch = -0.12 - lift * 0.22;
    p.kneeL = -0.2 - lift * 0.42;
    p.ankleL = Math.sin(c.t * 3.2) * 0.28;
    p.hipRoll = -lift * 0.04;
    p.armRRoll -= lift * 0.08;
    return p;
  }) satisfies Clip,
} as const;

/** Pelvis turns over a flexed support leg while the trunk counterbalances. */
function pivot(c: ClipCtx, side: number) {
  const p = ready(c, 0.35);
  const turn = (1 - Math.cos(c.t * 1.5 + c.seed * 0.1)) * 0.5;
  p.hipYaw = side * turn * 0.18;
  p.chest = -side * turn * 0.13;
  p.headYaw = side * turn * 0.34;
  p.legLRoll += side > 0 ? turn * 0.09 : 0;
  p.legRRoll -= side < 0 ? turn * 0.09 : 0;
  p.kneeL -= (side > 0 ? 0.2 : 0.08) * turn;
  p.kneeR -= (side < 0 ? 0.2 : 0.08) * turn;
  p.armLPitch = -side * turn * 0.21;
  p.armRPitch = side * turn * 0.21;
  return p;
}
