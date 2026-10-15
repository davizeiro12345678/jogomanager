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

type Composition = {
  distance: number;
  lateral: number;
  height: number;
  fov: number;
  lookRoom: number;
};

/**
 * A line index selects a composed variation, rather than a random camera.
 * Variants never reverse the dialogue axis: they only move from a neutral
 * portrait to a modest shoulder, low authority or elevated listening angle.
 */
function compositionFor(variant: number): Composition {
  const index = Math.abs(Number.isFinite(variant) ? Math.trunc(variant) : 0) % 4;
  switch (index) {
    case 1:
      return { distance: 0.06, lateral: 0.09, height: -0.045, fov: -0.8, lookRoom: 0.025 };
    case 2:
      return { distance: -0.035, lateral: -0.075, height: 0.055, fov: 0.6, lookRoom: -0.018 };
    case 3:
      return { distance: 0.11, lateral: 0.035, height: 0.02, fov: 1.1, lookRoom: 0.015 };
    default:
      return { distance: 0, lateral: 0, height: 0, fov: 0, lookRoom: 0 };
  }
}

function establishingVariation(shot: CinematicShot, variant: number): CinematicShot {
  const index = Math.abs(Number.isFinite(variant) ? Math.trunc(variant) : 0) % 3;
  if (index === 0) return { ...shot, position: [...shot.position], target: [...shot.target] };
  const side = index === 1 ? 1 : -1;
  return {
    ...shot,
    position: [shot.position[0] + side * 0.28, shot.position[1] + 0.07, shot.position[2]],
    target: [shot.target[0] + side * 0.09, shot.target[1] + 0.02, shot.target[2]],
    fov: shot.fov + 0.6,
  };
}

/** Masters establish the group and room, so a tall viewport needs to retain
 * horizontal coverage. Widen the lens instead of retreating through the back
 * wall. A 70-degree ceiling keeps the people at the sides from stretching;
 * landscape cameras and the authored positions/targets stay exact. */
function portraitMaster(shot: CinematicShot, aspect: number): CinematicShot {
  if (!Number.isFinite(aspect) || aspect <= 0 || aspect >= 0.78) return shot;
  const halfFov = (shot.fov * Math.PI) / 360;
  return {
    ...shot,
    fov: Math.min(70, (Math.atan(Math.tan(halfFov) * (0.78 / aspect)) * 360) / Math.PI),
  };
}

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
    return portraitMaster(establishingVariation(shot, variant), aspect);
  }
  const seated = kind === "locker" && speaker === "captain";
  const y = seated ? 1.06 : 1.59;
  const composition = compositionFor(variant);
  // The dressing-room decision scenes are already staged with the squad in
  // front of the coach. A regular close-up puts the virtual camera between
  // those people and loses the huddle, the shirts and the tactical board.
  // Treat that specific close grammar as an over-the-shoulder conversation:
  // it keeps the coach readable but leaves enough of the room in frame to
  // sell the occasion. Medical and gym scenes retain their tighter framing.
  const dressingRoomConversation = kind === "locker" && art === "dressing";
  const contextualDistance = dressingRoomConversation
    ? size === "close"
      ? 1.1
      : size === "proximo"
        ? 0.6
        : 0.12
    : 0;
  const contextualLateral = dressingRoomConversation
    ? size === "close"
      ? 0.76
      : size === "proximo"
        ? 0.34
        : 0.1
    : 0;
  const contextualFov = dressingRoomConversation
    ? size === "close"
      ? 5.4
      : size === "proximo"
        ? 2.2
        : 0.8
    : 0;
  // A dialogue close-up stays intimate while retaining the collar, shoulders
  // and part of the gesture. That extra contextual silhouette reads better
  // than an extreme face crop across the wide range of player morphologies.
  const distance =
    (size === "close" ? 1.62 : size === "proximo" ? 2.15 : 2.95) +
    contextualDistance +
    composition.distance;
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
        Math.min(
          6.55,
          mark[0] +
            side * (size === "close" ? 0.36 : 0.68) +
            side * contextualLateral +
            composition.lateral,
        ),
      ),
      y + 0.12 + composition.height,
      Math.min(
        kind === "locker" && art !== "gym" && art !== "medical" && speaker !== "captain"
          ? dressingRoomConversation
            ? 1.2
            : 0.25
          : 6.6,
        mark[1] + distance * portrait * (reverse ? -1 : 1),
      ),
    ],
    target: [
      mark[0],
      y -
        (size === "close" ? 0.11 : size === "proximo" ? 0.14 : 0.27) -
        (dressingRoomConversation && size !== "medio" ? 0.055 : 0) +
        composition.height * 0.2,
      mark[1],
    ],
    fov: (size === "close" ? 33 : size === "proximo" ? 33 : 38) + contextualFov + composition.fov,
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
    const room =
      Math.max(-1, Math.min(1, direction)) * (size === "close" ? 0.075 : 0.11) +
      composition.lookRoom;
    shot.target[0] += rightX * room;
    shot.target[2] += rightZ * room;
  }
  return shot;
}
