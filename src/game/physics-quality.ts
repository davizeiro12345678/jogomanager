/**
 * Continuous integration only. Match rules keep their own deterministic
 * 30 Hz clock; this contract limits each physical integration slice.
 */
export const HIGH_FIDELITY_PHYSICS_HZ = 139;
export const HIGH_FIDELITY_PHYSICS_STEP = 1 / HIGH_FIDELITY_PHYSICS_HZ;

/**
 * Splits a finite elapsed interval into slices no longer than 1 / 139 s.
 * A caller may cap pathological recovery work, but live 1 / 15 and 1 / 30
 * intervals fit inside the supplied caps in the physics consumers.
 */
export function highFidelitySubsteps(elapsed: number, maxSubsteps = Infinity) {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 1;
  const requested = Math.max(1, Math.ceil(elapsed * HIGH_FIDELITY_PHYSICS_HZ));
  const limit = Number.isFinite(maxSubsteps) ? Math.max(1, Math.floor(maxSubsteps)) : requested;
  return Math.min(requested, limit);
}
