import type { TimeOfDay, Weather } from "./matchday";

/** Presentation only: overcast daylight and stadium floodlights use the same
 * existing sources, with no extra lights, shadow maps or simulation state. */
export function matchLighting(time: TimeOfDay, weather: Weather, low: boolean) {
  const snow = weather === "neve";
  const cloud = weather === "chuva" || snow;
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
    fillIntensity: night ? (cloud ? 0.84 : 0.72) : cloud ? 0.62 : 0.36,
    hemiIntensity: low
      ? night
        ? cloud
          ? 0.5
          : 0.42
        : cloud
          ? 0.78
          : sunset
            ? 0.52
            : 0.64
      : night
        ? cloud
          ? 0.32
          : 0.22
        : cloud
          ? 0.5
          : sunset
            ? 0.3
            : 0.34,
    hemiColor: night ? "#a9c9ef" : cloud ? "#c5d5e0" : sunset ? "#ffe0c6" : "#dde9f0",
    // Snow bounces more neutral blue light under the athletes than wet grass.
    // Retain the existing hemisphere light and floodlight count.
    groundColor: snow
      ? night
        ? "#182d3e"
        : "#50636e"
      : night
        ? "#08131a"
        : cloud
          ? "#203027"
          : "#102c1d",
    environmentKey: night ? (cloud ? 1.58 : 1.45) : cloud ? 1.55 : sunset ? 1.45 : low ? 1.75 : 2.1,
    fogNear: snow ? (night ? 55 : 72) : night ? (cloud ? 65 : 80) : cloud ? 82 : sunset ? 95 : 120,
    fogFar: snow
      ? night
        ? 165
        : 220
      : night
        ? cloud
          ? 185
          : 230
        : cloud
          ? 245
          : sunset
            ? 270
            : 330,
  };
}
