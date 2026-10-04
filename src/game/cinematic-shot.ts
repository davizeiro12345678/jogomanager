import type { SceneArt, Speaker } from "@/content/cutscenes";
import type { ShotSize } from "./cutscene-director";
import {
  cinematicReactionSpeaker,
  cinematicStageFocus,
  type CinematicSet,
} from "./cinematic-blocking";
import type { CinematicDrill } from "./cinematic-action";

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
  art?: SceneArt,
  variant = 0,
  time = 0,
  drill: CinematicDrill = "dribble",
): CinematicShot {
  const mark = cinematicStageFocus(kind, speaker, art, festive, time, drill);
  if (opening || !mark || size === "geral") {
    const shot =
      art === "gym"
        ? ({
            position: [4.8, 2.3, 5.8],
            target: [0, 1.15, -1.1],
            fov: 49,
            framing: "establishing",
          } as CinematicShot)
        : art === "medical"
          ? ({
              position: [3.8, 2.1, 5.6],
              target: [-0.3, 1.15, -1.4],
              fov: 48,
              framing: "establishing",
            } as CinematicShot)
          : ESTABLISHING[kind];
    return { ...shot, position: [...shot.position], target: [...shot.target] };
  }
  const seated = kind === "locker" && speaker === "captain";
  const y = seated ? 1.06 : 1.59;
  const variation = (Math.abs(variant) % 3) - 1;
  const distance = (size === "close" ? 1.35 : size === "proximo" ? 2.15 : 2.95) + variation * 0.08;
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
  const shot: CinematicShot = {
    position: [
      Math.max(
        -6.55,
        Math.min(6.55, mark[0] + side * (size === "close" ? 0.36 : 0.68) + variation * 0.06),
      ),
      y + 0.12 + variation * 0.025,
      Math.min(
        kind === "locker" && art !== "gym" && art !== "medical" && speaker !== "captain"
          ? 0.25
          : 6.6,
        mark[1] + distance * portrait * (reverse ? -1 : 1),
      ),
    ],
    target: [mark[0], y - (size === "close" ? 0.04 : size === "proximo" ? 0.14 : 0.27), mark[1]],
    fov: size === "close" ? 29 : size === "proximo" ? 33 : 38,
    framing: "dialogue",
  };
  const partner = cinematicStageFocus(
    kind,
    cinematicReactionSpeaker(kind, speaker, art),
    art,
    festive,
    time,
    drill,
  );
  if (partner) {
    const dx = shot.position[0] - mark[0],
      dz = shot.position[2] - mark[1];
    const distanceXZ = Math.max(0.01, Math.hypot(dx, dz));
    const rightX = dz / distanceXZ,
      rightZ = -dx / distanceXZ;
    const direction = (partner[0] - mark[0]) * rightX + (partner[1] - mark[1]) * rightZ;
    const room = Math.max(-1, Math.min(1, direction)) * (size === "close" ? 0.075 : 0.11);
    shot.target[0] += rightX * room;
    shot.target[2] += rightZ * room;
  }
  return shot;
}
