import type { Cutscene } from "@/content/cutscenes";
import type { CinematicShot } from "./cinematic-shot";

// Static compositions share the marks of BusinessDressing. Dialogue still
// follows the actual speaker; only narration uses these editorial inserts.
const DOCUMENT: CinematicShot = {
  position: [1.3, 1.8, -0.2],
  target: [0.86, 0.826, -1.18],
  fov: 40,
  framing: "establishing",
};
const DOCUMENT_PORTRAIT: CinematicShot = {
  position: [1.3, 2.18, 0.08],
  target: [0.86, 0.826, -1.18],
  fov: 46,
  framing: "establishing",
};
const MEETING: CinematicShot = {
  position: [2.7, 1.95, 3.2],
  target: [0.35, 1.24, -2.05],
  fov: 46,
  framing: "establishing",
};
const ANNOUNCEMENT: CinematicShot = {
  position: [3.6, 2.18, 5.8],
  target: [1.25, 1.9, -2.25],
  fov: 48,
  framing: "establishing",
};

/** Allocation-free editorial shots, without introducing another scene pass. */
export function cinematicBusinessShot(
  business: Cutscene["business"],
  aspect: number,
): CinematicShot | null {
  if (!business) return null;
  if (business.stage === "signing")
    return Number.isFinite(aspect) && aspect < 1 ? DOCUMENT_PORTRAIT : DOCUMENT;
  // Tall viewports retain the wider ordinary set composition for meetings.
  if (!Number.isFinite(aspect) || aspect < 1) return null;
  return business.stage === "presentation" ? ANNOUNCEMENT : MEETING;
}
