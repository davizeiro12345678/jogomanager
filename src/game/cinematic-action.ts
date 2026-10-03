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
  const mark = cinematicDrillMark(index);
  if (kind === "dribble") {
    const phase = t * 0.45 + index * 1.3;
    const x = mark[0] + Math.sin(phase) * 0.75;
    const z = mark[1] + Math.cos(phase) * 0.75;
    const tap = Math.sin(t * 5.4 + index) ** 2;
    const ahead = 0.23 + tap * 0.16;
    return {
      x,
      z,
      yaw: Math.PI / 2 + phase,
      speed: 0.3375,
      phase: (t % 5.8) / 5.8,
      ballX: x + Math.cos(phase) * ahead,
      ballY: 0.11 + tap * 0.013,
      ballZ: z - Math.sin(phase) * ahead,
      windup: 0,
      strike: 0,
      follow: 0,
    };
  }
  const phase = ((t + index * 1.05) % 5.8) / 5.8;
  const contact = 0.34;
  const yaw = Math.atan2(-mark[0], -15.8 - mark[1]);
  const windup = windowAt(phase, 0.12, 0.26, contact);
  const strike = windowAt(phase, 0.27, contact + 0.015, 0.47);
  const follow = windowAt(phase, contact, 0.45, 0.65);
  const x = mark[0] + Math.sin(yaw) * strike * 0.04;
  const z = mark[1] + Math.cos(yaw) * strike * 0.04;
  const flight = Math.max(0, Math.min(1, (phase - contact) / 0.25));
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
    ballX: startX + (Math.sin(index * 1.7) * 2.4 - startX) * flight,
    ballY: 0.11 + Math.sin(Math.PI * flight) * 0.85 + flight * 0.08,
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
    out.spine += sample.windup * 0.08 - sample.follow * 0.06;
    out.hipYaw = -sample.windup * 0.12 + sample.follow * 0.15;
    if (!acting) {
      out.armLPitch = -sample.windup * 0.35 - sample.strike * 0.28;
      out.armLRoll = 0.07 + sample.strike * 0.32;
      out.armRPitch = sample.strike * 0.25;
      out.elbowL = -0.3 - sample.strike * 0.25;
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
