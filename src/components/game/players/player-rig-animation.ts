import {
  selectClip,
  type ClipCtx,
  type ClipName,
  type PlayerAction,
  type SelectCtx,
} from "@/game/animation";
import { GOAL_PRESENTATION_SECONDS } from "@/game/goal-choreography";
import { GAIT_SPEED } from "./player-rig-contract";

export interface PlayerRigAnimationInput {
  currentClip: ClipName;
  currentTime: number;
  deltaSeconds: number;
  previewClip?: ClipName | undefined;
  /** Stable per-event choice shared with the instanced player path. */
  selectedClip?: ClipName | undefined;
  previewAt?: number | undefined;
  goalProgress?: number | undefined;
  selection: SelectCtx;
}

export interface PlayerRigAnimationFrame {
  clip: ClipName;
  clipTime: number;
  progress: number;
  context: ClipCtx;
}

export function resolvePlayerRigAnimationFrame({
  currentClip,
  currentTime,
  deltaSeconds,
  previewClip,
  selectedClip,
  previewAt,
  goalProgress,
  selection,
}: PlayerRigAnimationInput): PlayerRigAnimationFrame {
  const clip = previewClip ?? selectedClip ?? selectClip(selection);
  const baseTime = clip === currentClip ? currentTime : 0;
  const nominal = GAIT_SPEED[clip];
  const cadence = nominal ? Math.max(0.55, Math.min(1.7, selection.speed / nominal)) : 1;
  const clipTime = baseTime + deltaSeconds * cadence;
  const progress =
    previewAt ??
    goalProgress ??
    (selection.action && selection.actionDur && selection.actionDur > 0
      ? 1 - Math.max(0, selection.actionT ?? 0) / selection.actionDur
      : (clipTime % 1.4) / 1.4);
  const context: ClipCtx = {
    t:
      previewAt !== undefined
        ? previewAt * (selection.actionDur || 1.4)
        : goalProgress !== undefined
          ? goalProgress * GOAL_PRESENTATION_SECONDS
          : clipTime,
    u: progress,
    speed: selection.speed,
    stride: Math.min(1, selection.speed / 7),
    seed: selection.seed,
  };

  return { clip, clipTime, progress, context };
}
