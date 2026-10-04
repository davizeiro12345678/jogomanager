import type { PlayerAction } from "./animation";

/**
 * The Player Studio reuses the match rig, including its shared ball-gaze
 * layer.  These are only off-stage presentation targets: the fixture never
 * advances a match or writes back into a save.
 */
export const STUDIO_ACTION_BALL_Z = 5;
export const STUDIO_NEUTRAL_GAZE_BALL_Z = 64;

export interface StudioGazeMovement {
  action: PlayerAction | null;
  hasBall?: boolean;
}

const BALL_FOCUSED_ACTIONS: ReadonlySet<PlayerAction> = new Set([
  "shot",
  "shotPower",
  "shotPlaced",
  "bicycle",
  "headClear",
  "duel",
  "chip",
  "volley",
  "header",
  "firstTime",
  "pass",
  "passLong",
  "cross",
  "trap",
  "tackle",
  "slide",
  "block",
  "intercept",
  "save",
  "saveHigh",
  "diveLeft",
  "diveRight",
  "catch",
  "distribute",
  "goalKick",
  "throwIn",
  "corner",
  "freeKick",
  "penalty",
  "feint",
  "cut",
  "stepover",
  "elastico",
]);

/** Keep inspection and locomotion portraits level; action previews retain ball tracking. */
export function studioBallFocusDistanceFor({
  action,
  hasBall = false,
}: StudioGazeMovement): number {
  return hasBall || (action !== null && BALL_FOCUSED_ACTIONS.has(action))
    ? STUDIO_ACTION_BALL_Z
    : STUDIO_NEUTRAL_GAZE_BALL_Z;
}
