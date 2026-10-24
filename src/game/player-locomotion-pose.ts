import { getClip, type ClipName } from "./animation";
import { emptyPose, mixPose, type Clip, type ClipCtx, type Pose } from "./animation-core";
import { gaitPoseAt, locomotionWeight, type GaitDirection } from "./gait-kinematics";
import type { Proportions } from "./player-model";

/** Per-renderer scratch. Fully overridden catalog motion must not be sampled:
 * run/sprint otherwise allocated a complete pose and blended 22 discarded joints.
 * Partial starts and every authored action retain the original catalog path.
 * Returned poses are mutable and must be copied if retained as history. */
export class PlayerLocomotionPose {
  private readonly gait = emptyPose();
  private readonly mixed = emptyPose();

  constructor(private readonly resolveClip: (name: ClipName) => Clip = getClip) {}

  sample(
    clip: ClipName,
    context: ClipCtx,
    action: string | null | undefined,
    phase: number,
    proportions: Pick<Proportions, "thigh" | "shin">,
    direction: GaitDirection,
  ): Pose {
    const weight = locomotionWeight(context.speed, action, clip);
    if (weight === 1)
      return gaitPoseAt(phase, context.speed, proportions, this.gait, direction).pose;
    const authored = this.resolveClip(clip)(context);
    if (weight === 0) return authored;
    return mixPose(
      authored,
      gaitPoseAt(phase, context.speed, proportions, this.gait, direction).pose,
      weight,
      this.mixed,
    );
  }
}
