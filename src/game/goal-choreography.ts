import type { MutableRefObject } from "react";
import type { PlayerAction } from "./animation";
import { FIELD_X, FIELD_Z } from "./sim-rules";
import type { Side, SimPlayer, SimView } from "./sim";

export type GoalCelebrationAction = "celebrate" | "celebrateRun" | "kneeSlide";

export interface GoalFocus {
  goalNumber: number;
  side: Side;
  scorerId: string;
  scorerAction: GoalCelebrationAction;
  x: number;
  z: number;
  /** Nearby teammates only; distant players keep their real match positions. */
  participantIds: readonly string[];
}

export type GoalFocusRef = MutableRefObject<GoalFocus | null>;

export interface GoalPresentation {
  action: PlayerAction;
  progress: number;
  actionSeed: number;
  rootX: number;
  rootZ: number;
  facingYaw?: number;
  facingWeight: number;
  attentionX: number;
  attentionZ: number;
}

export const GOAL_PRESENTATION_SECONDS = 1 / 0.22;

const MAX_HUDDLE_DISTANCE = 19;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const isScorerAction = (action: PlayerAction | null): action is GoalCelebrationAction =>
  action === "celebrate" || action === "celebrateRun" || action === "kneeSlide";

/** Captures the goal actor and a stable, nearby huddle from a match snapshot. */
export function captureGoalFocus(sim: SimView, goalNumber: number): GoalFocus | null {
  const active = sim.players.filter((player) => player.actionT > 0);
  const scorer =
    active.find((player) => player.action === "kneeSlide") ??
    active.find((player) => player.action === "celebrateRun") ??
    active.find((player) => player.action === "celebrate" && player.pos !== "GK") ??
    active.find((player) => player.action === "celebrate");
  const scorerAction = scorer?.action ?? null;
  if (!scorer || !isScorerAction(scorerAction)) return null;

  const participantIds = sim.players
    .filter(
      (player) =>
        player.side === scorer.side &&
        player.id !== scorer.id &&
        player.pos !== "GK" &&
        !player.sentOff &&
        Math.hypot(player.x - scorer.x, player.z - scorer.z) <= MAX_HUDDLE_DISTANCE,
    )
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
    .map((player) => player.id);

  return {
    goalNumber: Math.max(1, Math.trunc(goalNumber)),
    side: scorer.side,
    scorerId: scorer.id,
    scorerAction,
    x: scorer.x,
    z: scorer.z,
    participantIds,
  };
}

/** A presentation-only goal beat shared by the articulated and instanced rigs. */
export function goalPresentationFor(
  player: SimPlayer,
  focus: GoalFocus | null,
  pulse: number,
): GoalPresentation | null {
  const activePulse = clamp01(pulse);
  if (!focus || activePulse <= 0.01 || player.sentOff) return null;

  const progress = 1 - activePulse;
  const participantIndex = focus.participantIds.indexOf(player.id);
  const isScorer = player.id === focus.scorerId;
  const isHuddleMember = participantIndex >= 0;
  let action: PlayerAction = isScorer
    ? focus.scorerAction
    : player.side === focus.side
      ? isHuddleMember || player.pos === "GK"
        ? player.pos === "GK"
          ? "celebrate"
          : "hug"
        : "celebrate"
      : "dejected";

  const approach = smooth(progress / 0.2);
  const release = 1 - smooth((progress - 0.77) / 0.22);
  const hold = smooth(activePulse / 0.28);
  const formationWeight = approach * release * hold;
  let rootX = player.x;
  let rootZ = player.z;
  let facingYaw: number | undefined;

  if (isScorer) {
    rootX += (focus.x - player.x) * formationWeight;
    rootZ += (focus.z - player.z) * formationWeight;
  } else if (isHuddleMember) {
    const count = Math.max(1, focus.participantIds.length);
    const ring = Math.floor(participantIndex / 6);
    const ringStart = ring * 6;
    const ringSize = Math.min(6, count - ringStart);
    const ringIndex = participantIndex - ringStart;
    const angle = -Math.PI / 2 + ((ringIndex + 0.5) / ringSize) * Math.PI * 2 + ring * 0.24;
    const radius = 1.18 + ring * 0.86;
    const targetX = clamp(focus.x + Math.cos(angle) * radius, -FIELD_X + 1.4, FIELD_X - 1.4);
    const targetZ = clamp(focus.z + Math.sin(angle) * radius, -FIELD_Z + 1.2, FIELD_Z - 1.2);
    // Give nearby teammates time to cover the actual distance. Previously every
    // athlete crossed up to 19 metres in the same first fifth of the goal beat.
    const distance = Math.hypot(targetX - player.x, targetZ - player.z);
    const travelSeconds = Math.max(0.65, distance / 5.2);
    const arrival = smooth((progress * GOAL_PRESENTATION_SECONDS - 0.12) / travelSeconds);
    const memberWeight = arrival * release * hold;
    rootX += (targetX - player.x) * memberWeight;
    rootZ += (targetZ - player.z) * memberWeight;
    action = arrival < 0.93 && progress < 0.77 ? "celebrateRun" : "hug";
    facingYaw = Math.atan2(focus.x - rootX, focus.z - rootZ);
  }

  return {
    action,
    progress,
    actionSeed: focus.goalNumber,
    rootX,
    rootZ,
    ...(facingYaw === undefined ? {} : { facingYaw }),
    facingWeight: facingYaw === undefined ? 0 : formationWeight,
    attentionX: focus.x,
    attentionZ: focus.z,
  };
}
