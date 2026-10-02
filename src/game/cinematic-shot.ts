import type { Speaker } from "@/content/cutscenes";
import type { ShotSize } from "./cutscene-director";
import { cinematicFocus, type CinematicSet } from "./cinematic-blocking";

export interface CinematicShot {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  framing: "establishing" | "dialogue";
}
const ESTABLISHING: Record<CinematicSet, CinematicShot> = {
  locker: { position: [-2.7, 2.05, 6.2], target: [0, 1.1, -1.1], fov: 48, framing: "establishing" },
  press: { position: [3.8, 2.1, 5.4], target: [0, 1.12, -1.8], fov: 48, framing: "establishing" },
  office: {
    position: [-3.2, 2.05, 4.8],
    target: [0, 1.05, -2.0],
    fov: 47,
    framing: "establishing",
  },
  tunnel: { position: [1.5, 1.8, 6.8], target: [0, 1.35, -5.2], fov: 48, framing: "establishing" },
  pitch: { position: [-4.3, 2.7, 10], target: [0, 1.12, -1.2], fov: 49, framing: "establishing" },
  stands: { position: [-5, 3.5, 10], target: [0, 3.2, -6], fov: 49, framing: "establishing" },
  arrival: {
    position: [5.5, 2.55, 9.2],
    target: [-0.6, 1.35, -1.6],
    fov: 50,
    framing: "establishing",
  },
};

/** Fixed sides of the dialogue axis avoid crossing people, desks and walls.
 * Portrait framing backs up without putting the camera outside the room. */
export function cinematicShotFor(
  kind: CinematicSet,
  speaker: Speaker | null,
  size: ShotSize,
  aspect: number,
  festive = false,
  opening = false,
): CinematicShot {
  const mark = cinematicFocus(kind, speaker, festive);
  if (opening || !mark || size === "geral") {
    const shot = ESTABLISHING[kind];
    return { ...shot, position: [...shot.position], target: [...shot.target] };
  }
  const seated = kind === "locker" && speaker === "captain";
  const y = seated ? 1.06 : 1.59;
  const distance = size === "close" ? 2.05 : size === "proximo" ? 2.9 : 4.15;
  const portrait = Math.min(
    kind === "arrival" || kind === "pitch" ? 1.7 : 1.35,
    Math.max(1, 0.78 / Math.max(0.2, aspect)),
  );
  const reverse = kind === "press" && speaker === "press";
  const side =
    kind === "office"
      ? speaker === "president" || speaker === "agent"
        ? 1
        : -1
      : reverse
        ? 1
        : -1;
  return {
    position: [
      Math.max(-6.55, Math.min(6.55, mark[0] + side * (size === "close" ? 0.48 : 0.85))),
      y + 0.12,
      Math.min(
        kind === "locker" && speaker !== "captain" ? 0.25 : 6.6,
        mark[1] + distance * portrait * (reverse ? -1 : 1),
      ),
    ],
    target: [mark[0], y - (size === "close" ? 0.04 : size === "proximo" ? 0.14 : 0.27), mark[1]],
    fov: size === "close" ? 34 : size === "proximo" ? 39 : 44,
    framing: "dialogue",
  };
}
