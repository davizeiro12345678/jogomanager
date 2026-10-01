import type { PlayerAction } from "./animation";
import type { Pose } from "./animation-core";
import { solveLegTarget } from "./gait-kinematics";
import type { Proportions } from "./player-model";
import type { DominantFoot } from "./visual-context";
import { footballContactAt } from "./motion-metadata";

const smooth = (u: number) => {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
};
const segment = (u: number, start: number, end: number, a: number, b: number) =>
  a + (b - a) * smooth((u - start) / (end - start));

/** Match-event choreography over the existing catalog. The planted leg takes
 * the load while the striking leg winds up, makes contact and recovers.
 * These are visual offsets and never feed back into the match simulation. */
export function refineFootballAction(
  pose: Pose,
  action: PlayerAction | null,
  progress: number,
  p: Pick<Proportions, "thigh" | "shin">,
  foot: DominantFoot,
): Pose {
  if (!action) return pose;
  const u = Math.max(0, Math.min(1, progress));
  const length = p.thigh + p.shin;
  const envelope = Math.sin(Math.PI * u);
  const contact = footballContactAt(action);
  const leftFoot = foot === "left";
  const kicking =
    /^(shot|shotPower|shotPlaced|pass|passLong|cross|chip|firstTime|goalKick|freeKick|penalty|corner)$/.test(
      action,
    );
  if (kicking) {
    const power = /Power|Long|goalKick|freeKick/.test(action) ? 1 : action === "pass" ? 0.55 : 0.78;
    const preparation = contact - 0.18;
    const follow = contact + 0.22;
    const z =
      u < preparation
        ? segment(u, 0, preparation, 0.02, -0.25 * power)
        : u < contact
          ? segment(u, preparation, contact, -0.25 * power, 0.38 * power)
          : u < follow
            ? segment(u, contact, follow, 0.38 * power, 0.5 * power)
            : segment(u, follow, 1, 0.5 * power, 0.02);
    const lift =
      u < contact
        ? 0.025 + Math.sin((Math.PI * u) / contact) * 0.13 * power
        : 0.025 + Math.sin((Math.PI * (u - contact)) / (1 - contact)) * 0.24 * power;
    const drop = envelope * 0.07;
    const strike = solveLegTarget(z, length - drop - lift, p.thigh, p.shin);
    const support = solveLegTarget(-0.055, length - drop, p.thigh, p.shin);
    const left = leftFoot;
    pose.legLPitch = left ? strike.pitch : support.pitch;
    pose.legRPitch = left ? support.pitch : strike.pitch;
    pose.kneeL = left ? strike.knee : support.knee;
    pose.kneeR = left ? support.knee : strike.knee;
    pose.ankleL = left ? strike.ankle - 0.17 * envelope : support.ankle;
    pose.ankleR = left ? support.ankle : strike.ankle - 0.17 * envelope;
    pose.hipY = -drop;
    pose.hipYaw = (left ? -1 : 1) * Math.sin(Math.PI * (u - 0.2)) * power * 0.18;
    pose.hipRoll = (left ? -1 : 1) * envelope * 0.07;
    pose.spine = 0.04 + envelope * 0.08;
    pose.chest = -pose.hipYaw * 0.2;
    pose.headPitch = 0.1;
    // The support-side arm counterbalances the striking leg below shoulder
    // height. Mirror this too: the catalog's right-foot swing lifted one
    // fist overhead even when the athlete struck with the left foot.
    pose.armLPitch = envelope * (left ? 0.34 : -0.48);
    pose.armRPitch = envelope * (left ? -0.48 : 0.34);
    pose.armLRoll = 0.18 + envelope * (left ? 0.3 : 0.62);
    pose.armRRoll = -0.18 - envelope * (left ? 0.62 : 0.3);
    pose.elbowL = -0.45 - envelope * 0.32;
    pose.elbowR = pose.elbowL;
  } else if (action === "header" || action === "headClear") {
    pose.hipY = Math.sin(Math.PI * smooth((u - 0.08) / 0.84)) * 0.28;
    pose.headPitch = u < 0.48 ? -envelope * 0.28 : envelope * 0.3;
    pose.kneeL = -0.24 - envelope * 0.42;
    pose.kneeR = -0.24 - envelope * 0.36;
    pose.armLRoll = 0.3 + envelope * 0.52;
    pose.armRRoll = -pose.armLRoll;
  } else if (action === "diveLeft" || action === "diveRight") {
    const side = action === "diveLeft" ? 1 : -1;
    pose.hipY = envelope * 0.22;
    pose.hipRoll = side * envelope * 1.2;
    // Both hands lead the dive, above the head in the athlete's frame.
    // Wide arm abduction made the trailing hand point away from the save
    // after the pelvis rolled sideways.
    pose.armLPitch = -envelope * (side === 1 ? 2.8 : 2.52);
    pose.armRPitch = -envelope * (side === -1 ? 2.8 : 2.52);
    pose.armLRoll = 0.12 + 0.07 * envelope;
    pose.armRRoll = -pose.armLRoll;
    pose.elbowL = -0.15 - (1 - envelope) * 0.5;
    pose.elbowR = pose.elbowL;
    pose.kneeL = -0.25 - (side === 1 ? 0.45 : 0.15) * envelope;
    pose.kneeR = -0.25 - (side === -1 ? 0.45 : 0.15) * envelope;
  } else if (action === "trap" || action === "intercept" || action === "tackle") {
    const reach = Math.sin(Math.PI * smooth(u)) * (action === "trap" ? 0.18 : 0.32);
    const drop = envelope * (action === "tackle" ? 0.16 : 0.06);
    const active = solveLegTarget(
      reach,
      length - drop - (action === "trap" ? 0.075 : 0.025),
      p.thigh,
      p.shin,
    );
    const support = solveLegTarget(-0.055, length - drop, p.thigh, p.shin);
    pose.legLPitch = leftFoot ? active.pitch : support.pitch;
    pose.legRPitch = leftFoot ? support.pitch : active.pitch;
    pose.kneeL = leftFoot ? active.knee : support.knee;
    pose.kneeR = leftFoot ? support.knee : active.knee;
    pose.ankleL = leftFoot ? active.ankle : support.ankle;
    pose.ankleR = leftFoot ? support.ankle : active.ankle;
    pose.hipY = -drop;
    pose.spine = 0.08 + envelope * 0.13;
    pose.armLRoll = 0.2 + envelope * 0.4;
    pose.armRRoll = -pose.armLRoll;
    pose.headPitch = 0.15 * envelope;
  } else if (action === "duel" || action === "block") {
    pose.hipY -= envelope * 0.065;
    pose.hipRoll += (leftFoot ? -1 : 1) * envelope * 0.11;
    pose.legLRoll += envelope * 0.09;
    pose.legRRoll -= envelope * 0.09;
    pose.kneeL -= envelope * 0.18;
    pose.kneeR -= envelope * 0.18;
    pose.armLRoll = 0.3 + envelope * 0.37;
    pose.armRRoll = -pose.armLRoll;
    pose.elbowL = -0.75 - envelope * 0.32;
    pose.elbowR = pose.elbowL;
  } else if (action === "catch") {
    // Chest-height collection: reach, yield at impact, then draw the hands
    // towards the body. High saves retain their distinct overhead extension.
    const reach = smooth(u / contact);
    const absorb = smooth((u - contact) / 0.3);
    pose.armLPitch = -0.4 - reach * 0.72 + absorb * 0.34;
    pose.armRPitch = pose.armLPitch;
    pose.elbowL = -0.6 + reach * 0.15 - absorb * 0.82;
    pose.elbowR = pose.elbowL;
    pose.armLRoll = 0.13 + (1 - absorb) * 0.07;
    pose.armRRoll = -pose.armLRoll;
    pose.hipY = -0.07 - absorb * 0.04;
    pose.spine = 0.1 + absorb * 0.08;
    pose.headPitch = 0.04;
  } else if (action === "throwIn" || action === "saveHigh") {
    const release = smooth((u - contact) / (1 - contact));
    const extension = envelope ** 0.75;
    pose.armLPitch = action === "throwIn" ? -2.65 + release * 1.55 : -extension * 2.45;
    pose.armRPitch = pose.armLPitch;
    pose.elbowL = action === "throwIn" ? -0.8 * (1 - release) : -0.85 + extension * 0.65;
    pose.elbowR = pose.elbowL;
    pose.armLRoll = 0.23 + extension * 0.13;
    pose.armRRoll = -pose.armLRoll;
    pose.spine = action === "throwIn" ? -envelope * 0.18 + release * 0.16 : -extension * 0.08;
    pose.headPitch = -extension * 0.18;
    if (action === "saveHigh") pose.hipY = extension * 0.26;
  }
  return pose;
}
