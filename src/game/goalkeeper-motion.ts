import type { Pose } from "./animation-core";

const smooth = (u: number) => {
  const t = Math.max(0, Math.min(1, u));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const pulse = (u: number, start: number, end: number) =>
  Math.sin(Math.PI * smooth((u - start) / (end - start)));

/** Cosmetic goalkeeper mechanics with a short loaded push, a long contact
 * silhouette, delayed trunk/leg follow-through and a cushioned athletic reset.
 * These curves never change the simulated save, ball trajectory or event time. */
export function refineGoalkeeperAction(pose: Pose, action: string, u: number): void {
  const load = pulse(u, 0, 0.25);
  const launch = smooth((u - 0.15) / 0.27);
  const landing = smooth((u - 0.65) / 0.14);
  const rise = smooth((u - 0.81) / 0.19);
  const settle = 1 - rise;
  const flight = pulse(u, 0.19, 0.74);

  if (action === "save") {
    const reach = launch * (1 - smooth((u - 0.69) / 0.31));
    const absorb = pulse(u, 0.5, 0.9);
    pose.hipY = -load * 0.065 - absorb * 0.045;
    pose.hipPitch = load * 0.025;
    pose.hipYaw = pose.hipRoll = 0;
    pose.spine = 0.06 + load * 0.1 + absorb * 0.12;
    pose.chest = -load * 0.03 + absorb * 0.04;
    pose.headPitch = -reach * 0.03;
    pose.headYaw = 0;
    pose.armLPitch = pose.armRPitch = -0.18 - reach * 1.18 + absorb * 0.18;
    pose.armLRoll = 0.14 + reach * 0.09 - absorb * 0.03;
    pose.armRRoll = -pose.armLRoll;
    pose.elbowL = pose.elbowR = -0.48 + reach * 0.24 - absorb * 0.82;
    pose.legLPitch = pose.legRPitch = -load * 0.11 - absorb * 0.14;
    pose.legLRoll = 0.035;
    pose.legRRoll = -0.035;
    pose.kneeL = pose.kneeR = -0.12 - load * 0.46 - absorb * 0.32;
    pose.ankleL = pose.ankleR = 0;
  } else if (action === "diveLeft" || action === "diveRight") {
    const side = action === "diveLeft" ? 1 : -1;
    // The far leg releases after the push; the second glove arrives later.
    // Keep the contact at the existing match event, then decelerate the arms
    // while the pelvis and trailing leg continue along the flight arc.
    const drive = smooth((u - 0.16) / 0.25);
    const second = smooth((u - 0.205) / 0.265);
    const reach = drive * (1 - landing * 0.52) * settle;
    const supportReach = second * (1 - landing * 0.62) * settle;
    const absorb = pulse(u, 0.49, 0.8);
    const follow = pulse(u, 0.47, 0.81);
    pose.hipY = -load * 0.135 + flight * 0.42 - landing * settle * 0.4;
    pose.hipRoll = side * (drive * (1 - landing) * 1.33 + landing * 1.05) * settle;
    pose.hipPitch = flight * 0.09 - landing * settle * 0.38;
    pose.hipYaw = side * (flight * 0.085 + follow * 0.06);
    pose.spine = load * 0.19 - flight * 0.145 + landing * settle * 0.3;
    pose.chest = -flight * 0.075 + follow * 0.12;
    pose.headPitch = -reach * 0.11 + landing * settle * 0.12;
    pose.headYaw = -side * follow * 0.12;
    // The leading hand contacts first. The second hand follows slightly
    // behind; neither arm spreads sideways away from the ball.
    pose.armLPitch =
      -0.18 -
      load * 0.42 -
      (side === 1 ? reach * 2.68 : supportReach * 2.5) +
      absorb * (side === 1 ? 0.08 : 0.2);
    pose.armRPitch =
      -0.18 -
      load * 0.42 -
      (side === -1 ? reach * 2.68 : supportReach * 2.5) +
      absorb * (side === -1 ? 0.08 : 0.2);
    pose.armLRoll = 0.13 + reach * (side === 1 ? 0.045 : 0.025) + landing * settle * 0.25;
    pose.armRRoll = -0.13 - reach * (side === -1 ? 0.045 : 0.025) - landing * settle * 0.25;
    pose.elbowL =
      -0.38 +
      reach * 0.22 -
      load * 0.4 -
      landing * settle * 0.7 -
      absorb * 0.35 -
      (side === -1 ? reach * 0.2 : 0);
    pose.elbowR =
      -0.38 +
      reach * 0.22 -
      load * 0.4 -
      landing * settle * 0.7 -
      absorb * 0.35 -
      (side === 1 ? reach * 0.2 : 0);
    pose.legLPitch = -load * 0.32 + reach * (side === 1 ? -0.23 : 0.28) - landing * settle * 0.63;
    pose.legRPitch = -load * 0.32 + reach * (side === -1 ? -0.23 : 0.28) - landing * settle * 0.63;
    pose.legLRoll = side * reach * 0.085;
    pose.legRRoll = side * reach * 0.085;
    pose.kneeL =
      -0.14 -
      load * 0.65 -
      reach * (side === 1 ? 0.18 : 0.62) -
      follow * 0.16 -
      landing * settle * 0.9;
    pose.kneeR =
      -0.14 -
      load * 0.65 -
      reach * (side === -1 ? 0.18 : 0.62) -
      follow * 0.16 -
      landing * settle * 0.9;
    pose.ankleL = flight * 0.16 - landing * settle * 0.12;
    pose.ankleR = pose.ankleL;
  } else if (action === "saveHigh") {
    const contact = launch * (1 - smooth((u - 0.58) / 0.3));
    const absorb = pulse(u, 0.49, 0.81);
    const cushion = pulse(u, 0.71, 1);
    pose.hipY = -load * 0.125 + flight * 0.4 - cushion * 0.14;
    pose.hipPitch = -flight * 0.035;
    pose.hipYaw = flight * 0.045;
    pose.hipRoll = flight * 0.025;
    pose.spine = load * 0.16 - flight * 0.1 + cushion * 0.18;
    pose.chest = -flight * 0.045 + absorb * 0.085;
    pose.headPitch = -contact * 0.24 + cushion * 0.06;
    pose.headYaw = flight * 0.04;
    pose.armLPitch = -load * 0.35 - contact * 2.76;
    pose.armRPitch = -load * 0.35 - contact * 2.68;
    pose.armLRoll = 0.13 + contact * 0.065;
    pose.armRRoll = -0.13 - contact * 0.09;
    pose.elbowL = -0.55 + contact * 0.37 - absorb * 0.58;
    pose.elbowR = -0.55 + contact * 0.34 - absorb * 0.61;
    pose.legLPitch = -load * 0.25 - flight * 0.14 - cushion * 0.28;
    pose.legRPitch = -load * 0.25 + flight * 0.07 - cushion * 0.28;
    pose.legLRoll = 0.035 + flight * 0.045;
    pose.legRRoll = -0.035 - flight * 0.03;
    pose.kneeL = -0.08 - load * 0.62 - flight * 0.2 - cushion * 0.62;
    pose.kneeR = -0.08 - load * 0.62 - flight * 0.13 - cushion * 0.62;
    pose.ankleL = flight * 0.16;
    pose.ankleR = flight * 0.13;
  }
}
