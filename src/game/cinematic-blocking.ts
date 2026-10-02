import type { Speaker } from "@/content/cutscenes";
export type CinematicSet =
  "locker" | "tunnel" | "press" | "pitch" | "stands" | "office" | "arrival";

/** Actual actor marks in the existing sets; dialogue lenses target these,
 * while establishing shots retain the architecture and crowd. */
export function cinematicFocus(
  kind: CinematicSet,
  speaker: Speaker | null,
  festive = false,
): readonly [number, number] | null {
  if (!speaker || speaker === "narrator" || speaker === "commentator") return null;
  if (kind === "locker") return speaker === "captain" ? [-0.4, 0.6] : [0.2, -2.1];
  if (kind === "press") return speaker === "press" ? [-3.4, 2.4] : [0, -1.95];
  if (kind === "office")
    return speaker === "president" || speaker === "agent" ? [-0.9, -2.3] : [1.1, -2.3];
  if (kind === "tunnel") return [-0.95, 1];
  if (kind === "pitch") return festive ? [0, 0.4] : [-5.2, 0.4];
  if (kind === "arrival") return speaker === "fan" ? [-6.1, -3.4] : [1.9, 1.8];
  return null;
}
