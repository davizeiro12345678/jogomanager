import type { PostMoment, PostQuality } from "./presets";

/** A replay event alone must not download the cinematic lens on a small GPU. */
export function postPath(
  quality: PostQuality,
  moment: PostMoment,
  cinematic: boolean,
  legacy = false,
) {
  if (quality === "baixa") return "off";
  return quality === "alta" && (cinematic || moment !== "match" || legacy) ? "cinema" : "balanced";
}
