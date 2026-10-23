import type { SceneArt } from "@/content/cutscenes";
export type CinematicSet =
  "locker" | "tunnel" | "press" | "pitch" | "stands" | "office" | "arrival";
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
/** The dialogue can preload its set without loading actor blocking and drills. */
export function cinematicSetFor(art: SceneArt): CinematicSet {
  return SET_BY_ART[art];
}
