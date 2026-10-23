/** Minimal mutable surface shared by the batched bench animation and its tests. */
export type BenchSeatedActor = {
  group: { position: { y: number }; rotation: { z: number } } | null;
  torso: { rotation: { x: number } } | null;
  phase: number;
};

/**
 * Keep each substitute's established idle motion and goal bounce while letting
 * one R3F callback animate the whole bench. The function writes in place and
 * deliberately allocates no vectors, matrices or result objects per frame.
 */
export function animateBenchSeatedActor(actor: BenchSeatedActor, time: number, goalPulse: number) {
  if (actor.torso) actor.torso.rotation.x = Math.sin(time * 1.4 + actor.phase) * 0.05 - 0.06;
  if (!actor.group) return;
  const jumping = goalPulse > 0.5 ? Math.abs(Math.sin(time * 9 + actor.phase)) * 0.35 : 0;
  actor.group.position.y = 0.62 + jumping;
  actor.group.rotation.z = Math.sin(time * 0.9 + actor.phase) * 0.03;
}
