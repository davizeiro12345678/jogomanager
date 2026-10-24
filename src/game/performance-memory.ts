type ResourceEstimate = { geometryBytes: number; textureBytes: number };

function byteCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Optional browser heap diagnostics and scene estimates have different scopes.
 * Never substitute either for process RAM or device VRAM, or sum their values. */
export function performanceMemorySample(performanceLike: unknown, resources: ResourceEstimate) {
  let used: number | null = null;
  let allocated: number | null = null;
  let limit: number | null = null;
  try {
    const source = performanceLike as { memory?: unknown } | null;
    const memory = source?.memory as Record<string, unknown> | undefined;
    used = byteCount(memory?.["usedJSHeapSize"]);
    allocated = byteCount(memory?.["totalJSHeapSize"]);
    limit = byteCount(memory?.["jsHeapSizeLimit"]);
  } catch {
    // An optional browser/privacy getter may throw. Benchmarking still works.
  }
  return {
    jsHeap: {
      available: used !== null,
      usedBytes: used,
      allocatedBytes: allocated,
      limitBytes: limit,
      source: "performance.memory",
      scope:
        "browser-reported JS heap; excludes total process RAM and separate Worker/WASM memories",
    },
    sceneReferencedResources: {
      geometryBytes: byteCount(resources.geometryBytes),
      textureBytes: byteCount(resources.textureBytes),
      source: "scene-census",
      scope:
        "deduplicated visible scene geometry/texture objects; buffer bytes and estimated texture payload, not GPU allocation",
    },
    processRam: {
      available: false,
      bytes: null,
      reason:
        "not exposed by this browser benchmark; capture process/Worker memory with an external profiler",
    },
    deviceVram: {
      available: false,
      bytes: null,
      reason: "actual device allocation is not exposed by WebGL renderer.info or the scene census",
    },
  };
}

export const FRAME_METRIC_DEFINITIONS = {
  fps: "1000 / arithmetic mean frame interval in milliseconds",
  p95: "nearest-rank 95th percentile of frame intervals in milliseconds",
  onePercentLow: "1000 / arithmetic mean of the slowest ceil(frameCount * 0.01) frame intervals",
  stalls: "frame intervals longer than 50ms; visible long intervals stay in the distribution",
  scope: "observed renderer frame cadence; not separate CPU/GPU utilization or solver frequency",
} as const;
