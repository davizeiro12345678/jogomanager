import {
  selectClip,
  type ClipCtx,
  type ClipName,
  type PlayerAction,
  type SelectCtx,
} from "@/game/animation";
import { GOAL_PRESENTATION_SECONDS } from "@/game/goal-choreography";
import { GAIT_SPEED } from "./player-rig-contract";

/** Presentation clocks retain elapsed time even when integration must be bounded.
 * A long frame must not slow the pose relative to interpolated Worker positions. */
export class PlayerRigAnimationClock {
  private elapsed = 0;

  consume(rawSeconds: number, minimumInterval: number): number | null {
    this.elapsed += Number.isFinite(rawSeconds) ? Math.max(0, rawSeconds) : 0;
    if (this.elapsed + 1e-12 < minimumInterval) return null;
    const elapsed = this.elapsed;
    this.elapsed = 0;
    return elapsed;
  }

  reset(): void {
    this.elapsed = 0;
  }
}

/** Exponential support transfer has the same response at 10 and 60 Hz.
 * Linear dt*rate smoothing snapped the pelvis to its target at low FPS. */
export function supportShiftAt(previous: number, target: number, elapsed: number): number {
  const dt = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  return previous + (target - previous) * (1 - Math.exp(-14 * dt));
}

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
