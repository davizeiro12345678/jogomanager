import type { FpsSample } from "./fps-meter";

export type MatchMeasurementPhase =
  "intro" | "ceremony" | "paused" | "interval" | "finished" | "match";

/** Dialogue/cinematic probes have their own scene and must never promote the
 * stadium preset using an idle browser's RAF cadence. */
export function matchMeasurementPhase(state: {
  introActive: boolean;
  ceremonyActive: boolean;
  paused: boolean;
  halfHeld: boolean;
  done: boolean;
  postMatchStep: number | null;
  matchPhase: string;
}): MatchMeasurementPhase {
  if (state.introActive) return "intro";
  if (state.ceremonyActive) return "ceremony";
  if (state.done || state.postMatchStep !== null || state.matchPhase === "done") return "finished";
  if (state.halfHeld || state.matchPhase === "half" || state.matchPhase === "etBreak")
    return "interval";
  if (state.paused) return "paused";
  return "match";
}

export function matchMeasurementKey(context: {
  seed: string;
  home: string;
  away: string;
  quality: string;
  camera: string;
  speed: number;
  rulesRevision?: number;
  phase: MatchMeasurementPhase;
}): string {
  return JSON.stringify(context);
}

/** The route owns cooldown/manual preferences; this function rejects wrong
 * sources, phases and stale presets before classifying actual render pacing. */
export function nextAutomaticMatchQuality(
  sample: FpsSample,
  current: "baixa" | "media" | "alta",
  active: boolean,
): "baixa" | "media" | "alta" {
  if (
    !active ||
    sample.source !== "rendered" ||
    sample.phase !== "match" ||
    sample.quality !== current ||
    sample.seconds < 6 ||
    sample.windowMs === undefined ||
    !Number.isFinite(sample.windowMs) ||
    sample.windowMs < 6000 ||
    !Number.isFinite(sample.avg) ||
    !Number.isFinite(sample.low1) ||
    !Number.isFinite(sample.worst) ||
    sample.avg <= 0 ||
    sample.low1 <= 0 ||
    sample.worst <= 0
  )
    return current;
  if ((sample.avg < 34 || sample.low1 < 22) && current !== "baixa")
    return current === "alta" ? "media" : "baixa";
  if (sample.avg > 58 && sample.worst > 48 && current !== "alta")
    return current === "baixa" ? "media" : "alta";
  return current;
}
