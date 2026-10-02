import type { PlayerAction } from "./animation";
import type { Pose } from "./animation-core";
import { solveLegTarget } from "./gait-kinematics";
import type { Proportions } from "./player-model";
import type { DominantFoot } from "./visual-context";
import { footballContactAt } from "./motion-metadata";
import { refineGoalkeeperAction } from "./goalkeeper-motion";

const smooth = (u: number) => {
  const t = Math.max(0, Math.min(1, u));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const segment = (u: number, start: number, end: number, a: number, b: number) =>
  a + (b - a) * smooth((u - start) / (end - start));

const FOOT_ACTIONS =
  /^(shot|shotPower|shotPlaced|pass|passLong|cross|chip|volley|firstTime|goalKick|freeKick|penalty|corner|trap|intercept|tackle|feint|cut|elastico|stepover)$/;

/** Support follows the event phase, including stationary actions. The striking
 * foot keeps its authored ankle while the opposite leg carries the weight. */
export function footballSupportFor(
  action: PlayerAction | null,
  progress: number,
  hipWidth: number,
  foot: DominantFoot,
) {
  const u = Math.max(0, Math.min(1, progress));
  const weight = FOOT_ACTIONS.test(action ?? "") ? Math.sin(Math.PI * u) : 0;
  const bodyContact =
    action === "slide"
      ? smooth(u / 0.35) * (1 - smooth((u - 0.72) / 0.28))
      : action === "diveLeft" || action === "diveRight"
        ? smooth((u - 0.62) / 0.14) * (1 - smooth((u - 0.8) / 0.2))
        : 0;
  return {
    shiftX: (foot === "left" ? -1 : 1) * hipWidth * 0.2 * weight,
    plantedFoot:
      weight > 0.15 ? (foot === "left" ? ("right" as const) : ("left" as const)) : undefined,
    bodyContact,
  };
}

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
    /^(shot|shotPower|shotPlaced|pass|passLong|cross|chip|volley|firstTime|goalKick|freeKick|penalty|corner)$/.test(
      action,
    );
  if (kicking) {
    const placed = action === "shotPlaced" || action === "penalty";
    const chip = action === "chip";
    const volley = action === "volley";
    const power = /Power|Long|goalKick|freeKick/.test(action)
      ? 1
      : action === "pass"
        ? 0.55
        : chip
          ? 0.5
          : 0.78;
    const preparation = contact - (action === "firstTime" ? 0.075 : 0.18);
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
      (volley ? envelope * 0.24 : 0) +
      (u < contact
        ? 0.025 + Math.sin((Math.PI * u) / contact) * 0.13 * power
        : 0.025 + Math.sin((Math.PI * (u - contact)) / (1 - contact)) * 0.24 * power);
    const drop = envelope * 0.07;
    const strike = solveLegTarget(z, length - drop - lift, p.thigh, p.shin);
    const support = solveLegTarget(-0.055, length - drop, p.thigh, p.shin);
    const left = leftFoot;
    pose.legLPitch = left ? strike.pitch : support.pitch;
    pose.legRPitch = left ? support.pitch : strike.pitch;
    pose.kneeL = left ? strike.knee : support.knee;
    pose.kneeR = left ? support.knee : strike.knee;
    const ankle = strike.ankle + (chip ? 0.12 : placed ? -0.045 : -0.17) * envelope;
    pose.ankleL = left ? ankle : support.ankle;
    pose.ankleR = left ? support.ankle : ankle;
    pose.legLRoll = left ? -envelope * (placed ? 0.16 : 0.045) : envelope * 0.035;
    pose.legRRoll = left ? -envelope * 0.035 : envelope * (placed ? 0.16 : 0.045);
    pose.hipY = -drop;
    pose.hipYaw =
      (left ? -1 : 1) * envelope * Math.sin(Math.PI * (u - 0.2)) * (placed ? 0.34 : power * 0.24);
    pose.hipRoll = (left ? -1 : 1) * envelope * 0.07;
    pose.spine = 0.04 + envelope * 0.08;
    pose.chest = -pose.hipYaw * 0.2;
    pose.headPitch = envelope * 0.1;
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
    const load = Math.sin(Math.PI * smooth(u / 0.25));
    const flight = Math.sin(Math.PI * smooth((u - 0.2) / 0.56));
    const landing = Math.sin(Math.PI * smooth((u - 0.73) / 0.27));
    pose.hipY = flight * 0.38 - load * 0.105 - landing * 0.11;
    pose.headPitch =
      u < contact ? segment(u, 0.2, contact, -0.35, 0.28) : segment(u, contact, 0.85, 0.28, 0);
    pose.spine = -flight * 0.11 + landing * 0.15;
    pose.kneeL = -0.08 - load * 0.44 - flight * 0.33 - landing * 0.55;
    pose.kneeR = -0.08 - load * 0.42 - flight * 0.28 - landing * 0.55;
    pose.armLRoll = 0.16 + flight * 0.66 + landing * 0.22;
    pose.armRRoll = -pose.armLRoll;
  } else if (action === "save" || action === "diveLeft" || action === "diveRight") {
    refineGoalkeeperAction(pose, action, u);
  } else if (
    action === "feint" ||
    action === "cut" ||
    action === "elastico" ||
    action === "stepover"
  ) {
    const circle = Math.sin(Math.PI * smooth(u));
    const sway = Math.sin(u * Math.PI * 2) * envelope;
    const lateral = action === "stepover" ? Math.sin(u * Math.PI * 2) * 0.18 : sway * 0.12;
    const active = solveLegTarget(
      circle * 0.19,
      length - 0.08 - circle * 0.09,
      p.thigh,
      p.shin,
      lateral,
    );
    const support = solveLegTarget(-0.04, length - 0.08, p.thigh, p.shin);
    pose.legLPitch = leftFoot ? active.pitch : support.pitch;
    pose.legRPitch = leftFoot ? support.pitch : active.pitch;
    pose.kneeL = leftFoot ? active.knee : support.knee;
    pose.kneeR = leftFoot ? support.knee : active.knee;
    pose.legLRoll = leftFoot ? active.roll : 0.035;
    pose.legRRoll = leftFoot ? -0.035 : -active.roll;
    pose.ankleL = leftFoot ? active.ankle : support.ankle;
    pose.ankleR = leftFoot ? support.ankle : active.ankle;
    pose.hipY = -0.08 * envelope;
    pose.hipYaw = (leftFoot ? -1 : 1) * sway * (action === "cut" ? 0.36 : 0.18);
    pose.hipRoll = (leftFoot ? -1 : 1) * sway * 0.1;
    pose.spine = envelope * 0.16;
    pose.armLRoll = 0.16 + envelope * 0.42;
    pose.armRRoll = -pose.armLRoll;
    pose.elbowL = pose.elbowR = -0.35 - envelope * 0.5;
  } else if (action === "slide") {
    const extension = smooth(u / contact) * (1 - smooth((u - 0.7) / 0.3));
    const lead = leftFoot ? -1 : 1;
    pose.hipY = -extension * 0.48;
    pose.hipPitch = -extension * 0.58;
    pose.hipRoll = lead * extension * 0.32;
    // Extend close to horizontal while the rear leg folds beneath the seat.
    // A low rear thigh with a deeply bent knee kept its boot on the floor
    // and lifted the entire slide back into a standing kick.
    pose.legLPitch = leftFoot ? -extension * 0.93 : -extension * 1.62;
    pose.legRPitch = leftFoot ? -extension * 1.62 : -extension * 0.93;
    pose.kneeL = leftFoot ? -0.12 : -extension * 1.65;
    pose.kneeR = leftFoot ? -extension * 1.65 : -0.12;
    pose.spine = extension * 0.35;
    pose.armLPitch = extension * 0.35;
    pose.armRPitch = extension * 0.55;
    pose.armLRoll = 0.18 + extension * 0.63;
    pose.armRRoll = -pose.armLRoll;
    pose.elbowL = pose.elbowR = -0.3 - extension * 0.5;
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
  } else if (action === "saveHigh") {
    refineGoalkeeperAction(pose, action, u);
  } else if (action === "throwIn") {
    const release = smooth((u - contact) / (1 - contact));
    const extension = envelope ** 0.75;
    pose.armLPitch = -2.65 + release * 1.55;
    pose.armRPitch = pose.armLPitch;
    pose.elbowL = -0.8 * (1 - release);
    pose.elbowR = pose.elbowL;
    pose.armLRoll = 0.23 + extension * 0.13;
    pose.armRRoll = -pose.armLRoll;
    pose.spine = -envelope * 0.18 + release * 0.16;
    pose.headPitch = -extension * 0.18;
  }
  return pose;
}
