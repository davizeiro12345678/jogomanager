import type { TimeOfDay, Weather } from "./matchday";

/** Presentation only: overcast daylight and stadium floodlights use the same
 * existing sources, with no extra lights, shadow maps or simulation state. */
export function matchLighting(time: TimeOfDay, weather: Weather, low: boolean) {
  const cloud = weather === "chuva" || weather === "neve";
  const night = time === "noite",
    sunset = time === "entardecer";
  const sky = night
    ? cloud
      ? "#080f16"
      : "#060a10"
    : cloud
      ? sunset
        ? "#56616c"
        : weather === "neve"
          ? "#9aa8b4"
          : "#708895"
      : sunset
        ? "#4a3630"
        : "#8fbfe8";
  const keyColor = night ? "#e4ecff" : cloud ? "#e4edf3" : sunset ? "#ffc79a" : "#fff6e0";
  const key = night ? 1.18 : sunset ? 1.5 : 1.72;
  return {
    sky,
    keyColor,
    keyIntensity: key * 1.08 * (cloud && !night ? 0.64 : 1),
    keyPosition: (night ? [45, 42, 32] : sunset ? [65, 32, 28] : [50, 80, 40]) as [
      number,
      number,
      number,
    ],
    fillIntensity: night ? 0.72 : cloud ? 0.62 : 0.36,
    hemiIntensity: low
      ? night
        ? 0.42
        : cloud
          ? 0.78
          : sunset
            ? 0.52
            : 0.64
      : night
        ? 0.22
        : cloud
          ? 0.5
          : sunset
            ? 0.3
            : 0.34,
    hemiColor: night ? "#a9c9ef" : cloud ? "#c5d5e0" : sunset ? "#ffe0c6" : "#dde9f0",
    groundColor: night ? "#08131a" : cloud ? "#203027" : "#102c1d",
    environmentKey: cloud && !night ? 1.55 : night ? 1.45 : sunset ? 1.45 : low ? 1.75 : 2.1,
    fogNear: night ? 80 : cloud ? 82 : sunset ? 95 : 120,
    fogFar: night ? 230 : cloud ? 245 : sunset ? 270 : 330,
  };
}
