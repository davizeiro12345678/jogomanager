/** Room-local probe GI never runs without explicit user consent. */
export function probeGIOptedIn(): boolean {
  try {
    return globalThis.localStorage?.getItem("manager3d.cinema.probeGI") === "on";
  } catch {
    return false;
  }
}

/** Separate rooms have independent scenes; these volume dimensions are small. */
export const CINEMATIC_PROBE_BOUNDS = {
  width: 8,
  height: 4,
  depth: 8,
  resolution: 2,
  falloff: 0.35,
} as const;
