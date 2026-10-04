import type { SceneArt, Speaker } from "@/content/cutscenes";
import { cinematicDrillAt, type CinematicDrill } from "./cinematic-action";

export type CinematicSet =
  "locker" | "tunnel" | "press" | "pitch" | "stands" | "office" | "arrival";

export type CinematicStageRole = Exclude<Speaker, "narrator">;
export type CinematicStagePresence = "resident" | "overlay";

export interface CinematicStageActor {
  /** The literal authored speaker, never a visual stand-in from the set. */
  role: CinematicStageRole;
  /** Physical set that owns the actor mark. */
  set: CinematicSet;
  /** X/Z mark shared by the actor and the dialogue camera. */
  mark: readonly [number, number];
  /** A set fixture is already present, or a single semantic actor must be added. */
  presence: CinematicStagePresence;
}

type StageMark = readonly [number, number];

const SET_BY_ART = {
  arrival: "arrival",
  press: "press",
  dressing: "locker",
  trophy: "pitch",
  training: "pitch",
  gym: "locker",
  tactics: "locker",
  staff: "office",
  board: "office",
  transfer: "office",
  tunnel: "tunnel",
  kitroom: "locker",
  pitchentry: "pitch",
  celebration: "stands",
  defeat: "locker",
  farewell: "tunnel",
  bus: "arrival",
  office: "office",
  medical: "locker",
  gala: "press",
} as const satisfies Record<SceneArt, CinematicSet>;

const DEFAULT_ART_BY_SET: Record<CinematicSet, SceneArt> = {
  locker: "dressing",
  tunnel: "tunnel",
  press: "press",
  pitch: "pitchentry",
  stands: "celebration",
  office: "office",
  arrival: "arrival",
};

/** Marks of actors already mounted by the ordinary set components. */
const RESIDENT_MARKS: Record<CinematicSet, Partial<Record<CinematicStageRole, StageMark>>> = {
  locker: {
    captain: [-0.4, 0.6],
    manager: [0.2, -2.1],
  },
  tunnel: {
    captain: [-0.95, 1],
  },
  press: {
    manager: [0, -1.95],
    press: [-3.4, 2.4],
  },
  pitch: {},
  stands: {},
  office: {
    president: [-0.9, -2.3],
    manager: [1.1, -2.3],
  },
  arrival: {
    fan: [-6.1, -3.4],
    captain: [1.9, 1.8],
  },
};

/** A safe fallback when a new role has not yet received a composed mark. */
const OVERLAY_MARKS: Record<CinematicSet, StageMark> = {
  locker: [4.2, -1.9],
  tunnel: [2, -0.7],
  press: [1.75, -1.95],
  pitch: [5.8, 2.1],
  stands: [0, -7.8],
  office: [3.4, -1.8],
  arrival: [3.8, 1.5],
};

/**
 * The set dressing already reserves the resident marks above. Overlay actors
 * previously all used one spot in a room, so a scout, agent and assistant
 * could enter from the exact same place. These marks preserve the dialogue
 * axis while giving each role a distinct relationship to the desk, bench or
 * touchline. They are deliberately static: the physical actor and camera
 * agree even with reduced motion enabled.
 */
const ROLE_OVERLAY_MARKS: Record<CinematicSet, Partial<Record<CinematicStageRole, StageMark>>> = {
  locker: {
    assistant: [3.55, -1.35],
    doctor: [3.75, -2.35],
    scout: [3.95, -0.8],
    agent: [3.65, -2.75],
    president: [3.95, -2.55],
    press: [3.5, -0.35],
    referee: [3.7, 0.15],
    fan: [3.45, 0.35],
    commentator: [3.7, -0.55],
  },
  tunnel: {
    manager: [1.8, -1.15],
    assistant: [2.35, 0.15],
    doctor: [1.95, -1.95],
    referee: [1.35, 0.75],
    press: [2.3, -1.85],
    scout: [2.55, -0.45],
    agent: [2.15, -2.3],
    president: [2.5, -1.5],
    fan: [2.4, 0.55],
    commentator: [2.05, 0.1],
  },
  press: {
    captain: [1.45, -1.55],
    assistant: [2.15, -1.7],
    doctor: [1.85, -2.55],
    scout: [2.45, -2.35],
    agent: [1.8, -2.85],
    president: [2.5, -1.2],
    referee: [1.3, -2.35],
    fan: [2.35, -0.8],
    commentator: [1.55, -0.85],
  },
  pitch: {
    manager: [-3.6, -0.9],
    assistant: [-4.25, 0.2],
    doctor: [-3.25, 1.45],
    scout: [-3.65, 2.25],
    agent: [3.9, -1.3],
    president: [3.35, 0.75],
    press: [4.5, 1.65],
    referee: [0.7, -1.6],
    fan: [2.9, 3.05],
    commentator: [4.2, -0.1],
  },
  stands: {
    manager: [-1.35, -6.9],
    captain: [1.3, -6.85],
    assistant: [-2.3, -7.35],
    doctor: [-2.9, -7.6],
    scout: [-3.3, -7.15],
    agent: [2.65, -7.45],
    president: [3.1, -7.15],
    press: [2.25, -6.7],
    referee: [0, -6.55],
    commentator: [-0.5, -7.55],
  },
  office: {
    captain: [3.1, -1.1],
    assistant: [3.55, -1.25],
    doctor: [3.15, -2.55],
    scout: [3.75, -2.35],
    agent: [3.4, -1.8],
    press: [3.8, -0.75],
    referee: [2.95, -2.95],
    fan: [3.55, -0.25],
    commentator: [3.2, -0.55],
  },
  arrival: {
    manager: [3.15, 0.5],
    assistant: [4.1, 1.15],
    doctor: [3.5, 0.2],
    scout: [4.4, 0.5],
    agent: [3.6, 1.9],
    president: [4.45, 1.75],
    press: [3.0, 2.2],
    referee: [2.8, -0.35],
    commentator: [4.2, 2.45],
  },
};

function overlayMarkFor(set: CinematicSet, role: CinematicStageRole): StageMark {
  return ROLE_OVERLAY_MARKS[set][role] ?? OVERLAY_MARKS[set];
}

const GYM_RESIDENT_MARKS: Partial<Record<CinematicStageRole, StageMark>> = {
  captain: [-0.4, 0.6],
  doctor: [1.7, -1.4],
  manager: [-1.6, -1.7],
};

const MEDICAL_RESIDENT_MARKS: Partial<Record<CinematicStageRole, StageMark>> = {
  captain: [-0.4, 0.6],
  doctor: [-1.8, -0.9],
  manager: [1.6, -1.65],
};

/** Shared mapping for stage composition, shots, and any future presentation layer. */
export function cinematicSetFor(art: SceneArt): CinematicSet {
  return SET_BY_ART[art];
}

function trainingResidentMark(
  role: CinematicStageRole,
  time: number,
  drill: CinematicDrill,
): StageMark | null {
  if (role === "assistant") return [-5.2, 0.4];
  if (role === "manager") return [-4.7, -1.8];
  if (role !== "captain") return null;
  const athlete = cinematicDrillAt(time, 0, drill);
  return [athlete.x, athlete.z];
}

function residentMarkFor(
  art: SceneArt,
  set: CinematicSet,
  role: CinematicStageRole,
  festive: boolean,
  time: number,
  drill: CinematicDrill,
): StageMark | null {
  if (art === "training") return trainingResidentMark(role, time, drill);
  if (art === "gym") return GYM_RESIDENT_MARKS[role] ?? null;
  if (art === "medical") return MEDICAL_RESIDENT_MARKS[role] ?? null;
  if (set === "pitch" && role === "captain") return festive ? [0, 0.4] : [-5.2, 0.4];
  return RESIDENT_MARKS[set][role] ?? null;
}

/**
 * Resolves the exact authored speaker to the person the stage must render.
 * Narration remains environmental; every other Speaker gets a finite X/Z mark.
 */
export function cinematicStageActorFor(
  art: SceneArt,
  speaker: Speaker | null,
  festive = false,
  time = 0,
  drill: CinematicDrill = "dribble",
): CinematicStageActor | null {
  if (!speaker || speaker === "narrator") return null;
  const set = cinematicSetFor(art);
  const resident = residentMarkFor(art, set, speaker, festive, time, drill);
  const mark = resident ?? overlayMarkFor(set, speaker);
  return {
    role: speaker,
    set,
    mark: [mark[0], mark[1]],
    presence: resident ? "resident" : "overlay",
  };
}

/** Keep a listener reaction composed until the speaking voice has ended. */
export function cinematicReactionReady(
  lineTime: number,
  estimatedDuration: number,
  voicePlaying: boolean,
  allowed: boolean,
): boolean {
  return (
    allowed &&
    !voicePlaying &&
    Number.isFinite(lineTime) &&
    Number.isFinite(estimatedDuration) &&
    lineTime > Math.max(0, estimatedDuration) + 0.7
  );
}

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

/** Legacy set-level lookup retained for callers without an authored art. */
export function cinematicFocus(
  kind: CinematicSet,
  speaker: Speaker | null,
  festive = false,
): readonly [number, number] | null {
  return cinematicStageActorFor(DEFAULT_ART_BY_SET[kind], speaker, festive)?.mark ?? null;
}

/** Camera focus always follows the same resolved actor mark as the stage. */
export function cinematicStageFocus(
  kind: CinematicSet,
  speaker: Speaker | null,
  art?: SceneArt,
  festive = false,
  time = 0,
  drill: CinematicDrill = "dribble",
): readonly [number, number] | null {
  return (
    cinematicStageActorFor(art ?? DEFAULT_ART_BY_SET[kind], speaker, festive, time, drill)?.mark ??
    null
  );
}
