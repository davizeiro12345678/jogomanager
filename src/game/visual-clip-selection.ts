import { selectClip, type ClipName, type SelectCtx } from "./animation";

const choices = new WeakMap<
  object,
  Map<string, { event: number; action: string; clip: ClipName }>
>();

/** Shared by detailed and instanced players. Reception height and speed pick
 * the entry once; the falling ball must not switch chest/thigh/foot clips
 * midway through one action or when the camera changes the player's LOD. */
export function selectPlayerClip(view: object, playerId: string, context: SelectCtx): ClipName {
  let players = choices.get(view);
  if (!players) choices.set(view, (players = new Map()));
  if (!context.action) {
    players.delete(playerId);
    return selectClip(context);
  }
  const elapsed = Math.max(0, (context.actionDur ?? 0) - (context.actionT ?? 0));
  const event = context.actionSeed ?? Math.round((context.time - elapsed) * 30 + 1e-6);
  const prior = players.get(playerId);
  if (prior?.event === event && prior.action === context.action) return prior.clip;
  const clip = selectClip(context);
  players.set(playerId, { event, action: context.action, clip });
  return clip;
}
