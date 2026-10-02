import { emptyPose, JOINTS, type Pose } from "./animation-core";
import { footballContactAt } from "./motion-metadata";

export interface PoseBlendInput {
  clip: string;
  action: string | null;
  progress: number;
  instant?: boolean;
}
const smooth = (u: number) => {
  const t = Math.max(0, Math.min(1, u));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Transitions start from the last displayed pose, including interrupted
 * actions. Once settled, feet follow the stride without another low-pass lag.
 * Fixed action contact markers retain the authored pose even at low FPS. */
export class AthletePoseBlender {
  readonly pose = emptyPose();
  private readonly from = emptyPose();
  private ready = false;
  private clip = "";
  private progress = 0;
  private elapsed = 1;
  private duration = 0.2;

  sample(target: Pose, dt: number, input: PoseBlendInput): Pose {
    if (!this.ready || input.instant) {
      for (const joint of JOINTS)
        this.pose[joint] = Number.isFinite(target[joint]) ? target[joint] : 0;
      this.ready = true;
      this.clip = input.clip;
      this.progress = input.progress;
      this.elapsed = 1;
      return this.pose;
    }
    const changed =
      input.clip !== this.clip || (input.action && input.progress < this.progress - 0.3);
    if (changed) {
      for (const joint of JOINTS) this.from[joint] = this.pose[joint];
      this.elapsed = 0;
      this.duration = input.action ? 0.14 : 0.22;
      this.clip = input.clip;
    } else this.elapsed += Math.max(0, Math.min(0.5, dt));
    this.progress = input.progress;
    let weight = smooth(this.elapsed / this.duration);
    if (input.action && Math.abs(input.progress - footballContactAt(input.action)) < 0.075) {
      weight = 1;
      this.elapsed = this.duration;
    }
    for (const joint of JOINTS) {
      const desired = Number.isFinite(target[joint]) ? target[joint] : this.pose[joint];
      this.pose[joint] = this.from[joint] + (desired - this.from[joint]) * weight;
    }
    return this.pose;
  }
}
