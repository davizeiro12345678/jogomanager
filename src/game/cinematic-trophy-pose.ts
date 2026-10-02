import type { Pose } from "./animation-core";

/** A controlled lift holds both handles throughout preparation and recovery. */
export function cinematicTrophyPose(pose: Pose, time: number): Pose {
  const phase = Math.max(0, Number.isFinite(time) ? time : 0) % 16;
  const ease = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  const lift = ease((phase - 2) / 3) * (1 - ease((phase - 11) / 3));
  pose.armLPitch = pose.armRPitch = -1.15 - lift * 1.25;
  pose.elbowL = pose.elbowR = 0.78 - lift * 0.34;
  pose.armLRoll = -0.16 + lift * 0.16;
  pose.armRRoll = -pose.armLRoll;
  pose.spine *= 0.25;
  pose.chest *= 0.25;
  pose.headPitch = -lift * 0.12;
  return pose;
}
