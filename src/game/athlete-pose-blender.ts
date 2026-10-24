import { emptyPose, JOINTS, type JointName, type Pose } from "./animation-core";
import { footballContactAt } from "./motion-metadata";

export interface PoseBlendInput {
  clip: string;
  action: string | null;
  progress: number;
  /** Stable presentation event identity when two events reuse one clip. */
  event?: number | undefined;
  instant?: boolean;
  supportFoot?: "left" | "right" | undefined;
  /** Shared stride phase in radians; never restart it when a clip changes. */
  phase?: number;
}
const smooth = (u: number) => {
  const t = Math.max(0, Math.min(1, u));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const LEFT_SUPPORT = new Set<JointName>(["legLPitch", "legLRoll", "kneeL", "ankleL"]);
const RIGHT_SUPPORT = new Set<JointName>(["legRPitch", "legRRoll", "kneeR", "ankleR"]);

/** Transitions start from the last displayed pose, including interrupted
 * actions. Once settled, feet follow the stride without another low-pass lag.
 * Fixed action contact markers retain the authored pose even at low FPS. */
export class AthletePoseBlender {
  readonly pose = emptyPose();
  private readonly from = emptyPose();
  private readonly lastSample = emptyPose();
  private readonly velocity = emptyPose();
  private readonly entryVelocity = emptyPose();
  private ready = false;
  private clip = "";
  private progress = 0;
  private action: string | null = null;
  private event: number | undefined;
  private elapsed = 1;
  private duration = 0.2;
  private entryProgress = 0;

  sample(target: Pose, dt: number, input: PoseBlendInput): Pose {
    const progress = Number.isFinite(input.progress)
      ? Math.max(0, Math.min(1, input.progress))
      : this.progress;
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.5, dt)) : 0;
    if (!this.ready || input.instant) {
      for (const joint of JOINTS) {
        this.pose[joint] = Number.isFinite(target[joint]) ? target[joint] : 0;
        this.lastSample[joint] = this.pose[joint];
        this.velocity[joint] = 0;
        this.entryVelocity[joint] = 0;
      }
      this.ready = true;
      this.clip = input.clip;
      this.progress = progress;
      this.action = input.action;
      this.event = input.event;
      this.elapsed = 1;
      return this.pose;
    }
    const changed =
      input.clip !== this.clip ||
      input.action !== this.action ||
      (input.action && (progress < this.progress - 1e-4 || input.event !== this.event));
    if (changed) {
      for (const joint of JOINTS) {
        this.from[joint] = this.pose[joint];
        this.entryVelocity[joint] = this.velocity[joint];
      }
      this.elapsed = 0;
      this.entryProgress = progress;
      this.duration = input.action ? 0.14 : 0.22;
      this.clip = input.clip;
    } else this.elapsed += step;
    this.progress = progress;
    this.action = input.action;
    this.event = input.event;
    let weight = smooth(this.elapsed / this.duration);
    if (input.action) {
      const contact = footballContactAt(input.action);
      // Converge continuously to the authored impact. A proximity window
      // previously jumped to full weight several frames before contact.
      const untilContact = contact - this.entryProgress;
      const contactWeight =
        untilContact > 0 ? smooth((progress - this.entryProgress) / untilContact) : 1;
      weight = Math.max(weight, contactWeight);
      if (progress >= contact) this.elapsed = this.duration;
    }
    const supportPhase = Number.isFinite(input.phase) ? Math.abs(Math.cos(input.phase!)) : 1;
    const supportWeight = smooth(this.elapsed / (this.duration * (0.65 + 0.15 * supportPhase)));
    const u = Math.max(0, Math.min(1, this.elapsed / this.duration));
    const momentumEnvelope = u * (1 - u) ** 3 * this.duration;
    const support =
      input.supportFoot === "left"
        ? LEFT_SUPPORT
        : input.supportFoot === "right"
          ? RIGHT_SUPPORT
          : null;
    for (const joint of JOINTS) {
      // Settle the planted chain earlier while the trunk carries outgoing
      // momentum. Final ground IK still owns the world-space sole contact.
      const planted = support?.has(joint) ?? false;
      const jointWeight = planted ? Math.max(weight, supportWeight) : weight;
      const desired = Number.isFinite(target[joint]) ? target[joint] : this.pose[joint];
      // Render adapters may add final ground ankle corrections to `pose`.
      // They must not feed those corrections back into joint momentum.
      const previous = this.lastSample[joint];
      // Carry the outgoing joint momentum through an interruption. The cubic
      // envelope has unit initial derivative and zero final slope. Contact
      // convergence removes it completely at the authored ball/foot marker.
      const carry = momentumEnvelope * (1 - jointWeight);
      this.pose[joint] =
        this.from[joint] +
        (desired - this.from[joint]) * jointWeight +
        this.entryVelocity[joint] * carry;
      if (!changed && step > 0) {
        // Root height is metres, other channels are radians. Reusing the
        // angular cap could launch the hips during an interrupted landing.
        const cap = joint === "hipY" ? 0.65 : 16;
        this.velocity[joint] = Math.max(-cap, Math.min(cap, (this.pose[joint] - previous) / step));
      }
      this.lastSample[joint] = this.pose[joint];
    }
    return this.pose;
  }
}
