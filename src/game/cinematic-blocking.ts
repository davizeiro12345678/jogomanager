import type { SceneArt, Speaker } from "@/content/cutscenes";
import { cinematicDrillAt, type CinematicDrill } from "./cinematic-action";
export type CinematicSet =
  "locker" | "tunnel" | "press" | "pitch" | "stands" | "office" | "arrival";

export function cinematicReactionSpeaker(
  kind: CinematicSet,
  speaker: Speaker | null,
  art?: SceneArt,
): Speaker | null {
  if (!speaker || speaker === "narrator" || speaker === "commentator") return null;
  if (kind === "press") return speaker === "press" ? "manager" : "press";
  if (kind === "office") return speaker === "manager" ? "president" : "manager";
  if (art === "gym" || art === "medical") return speaker === "manager" ? "doctor" : "captain";
  if (["locker", "pitch", "tunnel"].includes(kind))
    return speaker === "captain" ? "manager" : "captain";
  return null;
}

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

export function cinematicStageFocus(
  kind: CinematicSet,
  speaker: Speaker | null,
  art?: SceneArt,
  festive = false,
  time = 0,
  drill: CinematicDrill = "dribble",
): readonly [number, number] | null {
  if (!speaker || speaker === "narrator" || speaker === "commentator") return null;
  if (art === "training") {
    if (speaker === "assistant") return [-5.2, 0.4];
    if (speaker === "manager") return [-4.7, -1.8];
    const athlete = cinematicDrillAt(time, 0, drill);
    return [athlete.x, athlete.z];
  }
  if (art === "gym" || art === "medical") {
    if (speaker === "captain") return [-0.4, 0.6];
    if (speaker === "doctor") return art === "medical" ? [-1.8, -0.9] : [1.7, -1.4];
    return art === "medical" ? [1.6, -1.65] : [-1.6, -1.7];
  }
  return cinematicFocus(kind, speaker, festive);
}
