import { segmentsFor } from "./player-model";

/** Screen coverage, not global quality, decides when dense topology is readable. */
export function denseMatchRig(coverage: number, previous = false): boolean {
  return Number.isFinite(coverage) && coverage >= (previous ? 0.14 : 0.2);
}

export function matchRigSegments(
  quality: "alta" | "media" | "baixa",
  dense: boolean,
  match = false,
) {
  // Only the athlete that wins the screen-coverage LOD gets the presentation
  // mesh.  This keeps the ordinary 22-player match inside the established
  // draw/triangle budget while making a replay or player-career close-up read
  // like a genuinely denser model.
  if (quality === "alta" && match) return dense ? { radial: 32, cap: 12 } : { radial: 16, cap: 6 };
  if (quality === "alta" && !dense) return { radial: 16, cap: 6 };
  return segmentsFor(quality === "alta" ? 0 : quality === "media" ? 1 : 2);
}

/** Legacy geometry is selectable only in the isolated graphics fixture for A/B QA. */
export function legacyMatchRigRequested(pathname: string, search: string): boolean {
  return (
    pathname.endsWith("/graphics-benchmark.html") &&
    new URLSearchParams(search).get("rigTopology") === "legacy"
  );
}
