import type { SceneArt } from "../content/cutscenes";
import type { CinematicSet } from "./cinematic-blocking";

/** The club arrival is outdoors in afternoon daylight, even during tense dialogue.
 * Keep atmospheric continuity between cuts without another light or shadow map. */
export function cinematicArrivalLighting(kind: CinematicSet, art: SceneArt) {
  if (kind !== "arrival" || art !== "arrival") return null;
  return {
    sky: "#8fa8bd",
    fog: "#8299a9",
    ambient: 0.7,
    hemisphere: 0.76,
    hemisphereGround: "#66604c",
    keyColor: "#fff0d3",
    keyIntensity: 2.8,
  } as const;
}
