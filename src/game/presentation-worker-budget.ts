export interface PresentationWorkerBudget {
  /** Maximum concurrent background workers across the whole renderer. */
  total: number;
  /** KTX2/Basis transcoding and request queue share this portion. */
  textures: number;
  /** Geometry preparation, crowd visibility and other presentation jobs. */
  geometry: number;
}

/**
 * Reserve capacity for the render thread, sequential match simulation and
 * browser headroom. Logical core count is only a budget hint, not affinity.
 */
export function presentationWorkerBudget(
  cores: number | undefined,
  memoryGb: number | undefined,
): PresentationWorkerBudget {
  const logicalCores = Number.isFinite(cores) && (cores ?? 0) > 0 ? Math.floor(cores!) : 4;
  let total = Math.min(4, Math.max(0, logicalCores - 3));
  if (total === 0) return { total, textures: 0, geometry: 0 };

  // On memory-limited devices, spend at most one worker on a compressed
  // texture currently used by the scene and leave geometry at its light LOD.
  if (memoryGb !== undefined && memoryGb <= 3) total = Math.min(total, 1);
  const geometry = total >= 4 ? 2 : total > 1 ? 1 : 0;
  const textures = total - geometry;
  return { total, textures, geometry };
}

export function devicePresentationWorkerBudget(): PresentationWorkerBudget {
  if (typeof navigator === "undefined") return presentationWorkerBudget(undefined, undefined);
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return presentationWorkerBudget(navigator.hardwareConcurrency, memoryGb);
}

export function deviceGeometryPreparationWorkers(): number {
  return devicePresentationWorkerBudget().geometry;
}
