import type { Pose } from "./animation-core";
import { emptyPose } from "./animation-core";
import { gaitCadence, gaitPoseAt } from "./gait-kinematics";
import { clampPoseAnatomy, soleHeightFor } from "./ground-contact";
import type { Proportions } from "./player-model";

const smooth = (value: number) => {
  const u = Math.max(0, Math.min(1, value));
  return u * u * (3 - 2 * u);
};
const windowAt = (time: number, start: number, peak: number, end: number) =>
  time < peak ? smooth((time - start) / (peak - start)) : 1 - smooth((time - peak) / (end - peak));
export type CinematicDrill = "dribble" | "finish";

export function cinematicDrillFor(cueId = ""): CinematicDrill {
  return /finishing|finaliza/iu.test(cueId) ? "finish" : "dribble";
}
export function cinematicDrillMark(index: number): readonly [number, number] {
  return [-2.4 + index * 1.55, -1.2 + (index % 2) * 2.7];
}

/** Actor, ball, camera and shadow share one contact timeline and route. */
export function cinematicDrillAt(time: number, index: number, kind: CinematicDrill) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
  const mark = cinematicDrillMark(safeIndex);
  if (kind === "dribble") {
    // The route breathes with the stride: a player takes shorter corrective
    // touches on the inside of the turn, rather than orbiting the ball at a
    // constant speed forever.
    const phase = t * 0.45 + safeIndex * 1.3;
    const stride = Math.sin(t * 5.4 + safeIndex);
    const radius = 0.69 + Math.sin(t * 1.35 + safeIndex * 0.7) * 0.06;
    const x = mark[0] + Math.sin(phase) * radius;
    const z = mark[1] + Math.cos(phase) * (radius + 0.035);
    const tap = stride * stride;
    const ahead = 0.22 + tap * 0.14;
    const outside = Math.sign(stride || 1) * 0.055;
    return {
      x,
      z,
      yaw: Math.PI / 2 + phase,
      speed: 0.315 + (1 - tap) * 0.045,
      phase: (t % 5.8) / 5.8,
      ballX: x + Math.cos(phase) * ahead + Math.sin(phase) * outside,
      ballY: 0.11 + tap * 0.013,
      ballZ: z - Math.sin(phase) * ahead + Math.cos(phase) * outside,
      windup: 0,
      strike: 0,
      follow: 0,
    };
  }
  const phase = ((t + safeIndex * 1.05) % 5.8) / 5.8;
  const contact = 0.34;
  const yaw = Math.atan2(-mark[0], -15.8 - mark[1]);
  const windup = windowAt(phase, 0.12, 0.26, contact);
  const strike = windowAt(phase, 0.27, contact + 0.015, 0.47);
  const follow = windowAt(phase, contact, 0.45, 0.65);
  const x = mark[0] + Math.sin(yaw) * strike * 0.04;
  const z = mark[1] + Math.cos(yaw) * strike * 0.04;
  const flight = Math.max(0, Math.min(1, (phase - contact) / 0.25));
  const curl = Math.sin(safeIndex * 1.7) * 2.4;
  const startX = x + Math.sin(yaw) * 0.42 + Math.cos(yaw) * 0.1;
  const startZ = z + Math.cos(yaw) * 0.42 - Math.sin(yaw) * 0.1;
  return {
    x,
    z,
    yaw,
    speed: 0,
    phase,
    windup,
    strike,
    follow,
    ballX: startX + (curl - startX) * flight,
    ballY: 0.11 + Math.sin(Math.PI * flight) * (0.8 + Math.abs(curl) * 0.025) + flight * 0.08,
    ballZ: startZ + (-15.8 - startZ) * flight,
  };
}

export function cinematicDrillPose(
  out: Pose,
  sample: ReturnType<typeof cinematicDrillAt>,
  p: Proportions,
  time: number,
  acting: boolean,
  scratch = emptyPose(),
) {
  if (sample.speed > 0) {
    gaitPoseAt(
      time * gaitCadence(sample.speed, p.thigh + p.shin) * Math.PI * 2,
      sample.speed,
      p,
      scratch,
    );
    for (const key of [
      "hipY",
      "hipPitch",
      "hipRoll",
      "hipYaw",
      "legLPitch",
      "legRPitch",
      "legLRoll",
      "legRRoll",
      "kneeL",
      "kneeR",
      "ankleL",
      "ankleR",
    ] as const)
      out[key] = scratch[key];
    if (!acting)
      for (const key of ["armLPitch", "armRPitch", "elbowL", "elbowR"] as const)
        out[key] = scratch[key];
  } else {
    out.hipY = -0.015 - sample.windup * 0.035;
    out.legLPitch = -0.07;
    out.kneeL = -0.14;
    out.ankleL = -0.07;
    out.legRPitch = sample.windup * 0.44 - sample.strike * 0.68 - sample.follow * 0.23;
    out.kneeR = -sample.windup * 1.05 - sample.follow * 0.24;
    out.ankleR = sample.windup * 0.24 - sample.strike * 0.28;
    // The kick reads through a planted hip, then the torso counter-rotates
    // after contact. This keeps the pose athletic without moving the contact
    // foot away from the shared ground solver below.
    out.spine += sample.windup * 0.1 - sample.strike * 0.055 - sample.follow * 0.075;
    out.chest += sample.windup * 0.04 - sample.follow * 0.065;
    out.headPitch += sample.windup * 0.025 - sample.follow * 0.04;
    out.hipYaw = -sample.windup * 0.12 + sample.follow * 0.15;
    if (!acting) {
      out.armLPitch = -sample.windup * 0.35 - sample.strike * 0.28;
      out.armLRoll = 0.07 + sample.strike * 0.32;
      out.armRPitch = sample.strike * 0.25;
      out.elbowL = -0.3 - sample.strike * 0.25;
    } else {
      // Retain authored dialogue arms, while giving a live drill just enough
      // counterbalance to avoid a rigid upper body.
      out.armLPitch -= sample.windup * 0.08 + sample.follow * 0.06;
      out.armRPitch += sample.strike * 0.06;
      out.elbowL -= sample.follow * 0.08;
    }
  }
  clampPoseAnatomy(out);
  const input = {
    P: p,
    pose: out,
    hipShiftX: 0,
    leanX: 0,
    leanZ: 0,
    airborne: 0,
    previousRootY: 0,
    dt: 0,
  };
  out.hipY -= Math.min(soleHeightFor(input, true).y, soleHeightFor(input, false).y);
  return out;
}

/** Controlled alternating curls: lift, hold, lower and rest on the same seat. */
export function cinematicCurlAt(time: number) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  const curl = (offset: number) => {
    const u = ((t + offset) % 6.4) / 6.4;
    return u < 0.32 ? smooth(u / 0.32) : u < 0.4 ? 1 : 1 - smooth((u - 0.4) / 0.4);
  };
  return { left: curl(0), right: curl(2.7) };
}

export function cinematicAttentionYaw(
  x: number,
  z: number,
  rotation: number,
  attention: readonly [number, number],
) {
  const difference = Math.atan2(attention[0] - x, attention[1] - z) - rotation;
  return Math.max(-0.7, Math.min(0.7, Math.atan2(Math.sin(difference), Math.cos(difference))));
}
