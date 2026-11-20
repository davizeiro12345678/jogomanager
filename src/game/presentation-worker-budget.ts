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
  // Large devices can prepare disjoint crowd ranges on four cores, but
  // always reserve at least six logical cores for rendering, simulation,
  // browser work, and OS tasks. Small devices keep the original budget.
  let total =
    logicalCores >= 12 ? 6 : Math.min(4, Math.max(0, logicalCores - 3));
  if (total === 0) return { total, textures: 0, geometry: 0 };

  // Mobile and memory-limited devices never increase worker parallelism.
  if (memoryGb !== undefined && memoryGb <= 3) total = Math.min(total, 1);
  else if (memoryGb !== undefined && memoryGb <= 4) total = Math.min(total, 4);
  const geometry = total >= 6 ? 4 : total >= 4 ? 2 : total > 1 ? 1 : 0;
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
