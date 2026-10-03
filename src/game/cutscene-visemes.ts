export type VisemeShape =
  | "silence"
  | "MBP"
  | "FV"
  | "TH"
  | "DD"
  | "KG"
  | "CH"
  | "SS"
  | "NN"
  | "RR"
  | "AA"
  | "E"
  | "I"
  | "O"
  | "U";

export interface TimedViseme {
  /** Time relative to the beginning of the encoded voice clip. */
  atMs: number;
  shape: VisemeShape;
  weight?: number;
}

export interface MouthPose {
  /** Normalized jaw opening, lip spread and lip rounding. */
  open: number;
  wide: number;
  round: number;
}

export interface CinematicVoiceClock {
  currentTimeMs(): number;
  sample(out?: MouthPose): MouthPose;
}

export type CinematicVoiceClockRef = { current: CinematicVoiceClock | null };

export interface AudioContextClock {
  readonly currentTime: number;
}

const REST: MouthPose = { open: 0.015, wide: 0.1, round: 0 };
const SHAPES: Record<VisemeShape, MouthPose> = {
  silence: REST,
  MBP: { open: 0.015, wide: 0.08, round: 0 },
  FV: { open: 0.1, wide: 0.24, round: 0 },
  TH: { open: 0.19, wide: 0.32, round: 0 },
  DD: { open: 0.2, wide: 0.35, round: 0.04 },
  KG: { open: 0.3, wide: 0.24, round: 0.06 },
  CH: { open: 0.16, wide: 0.18, round: 0.18 },
  SS: { open: 0.12, wide: 0.64, round: 0 },
  NN: { open: 0.13, wide: 0.26, round: 0.02 },
  RR: { open: 0.2, wide: 0.14, round: 0.4 },
  AA: { open: 0.82, wide: 0.48, round: 0 },
  E: { open: 0.26, wide: 0.82, round: 0 },
  I: { open: 0.18, wide: 0.92, round: 0 },
  O: { open: 0.4, wide: 0, round: 0.9 },
  U: { open: 0.2, wide: 0, round: 1 },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function weighted(shape: VisemeShape, weight: number, out: MouthPose): MouthPose {
  const target = SHAPES[shape];
  const w = clamp01(weight);
  out.open = REST.open + (target.open - REST.open) * w;
  out.wide = REST.wide + (target.wide - REST.wide) * w;
  out.round = target.round * w;
  return out;
}

/** Sample a compact, authored viseme track without allocating in the frame loop. */
export function sampleVisemeAt(
  track: readonly TimedViseme[],
  timeMs: number,
  out: MouthPose = { open: REST.open, wide: REST.wide, round: REST.round },
): MouthPose {
  if (!track.length || !Number.isFinite(timeMs) || timeMs < track[0]!.atMs) {
    out.open = REST.open;
    out.wide = REST.wide;
    out.round = REST.round;
    return out;
  }
  let current = 0;
  while (current + 1 < track.length && track[current + 1]!.atMs <= timeMs) current++;

  const cue = track[current]!;
  const pose = weighted(cue.shape, cue.weight ?? 1, out);
  const next = track[current + 1];
  if (!next) {
    const fadeMs = Math.min(80, Math.max(24, cue.atMs * 0.08));
    const fade = 1 - smooth((timeMs - cue.atMs) / fadeMs);
    pose.open = REST.open + (pose.open - REST.open) * fade;
    pose.wide = REST.wide + (pose.wide - REST.wide) * fade;
    pose.round *= fade;
    return pose;
  }

  const interval = next.atMs - cue.atMs;
  const blendMs = Math.min(55, Math.max(18, interval * 0.38));
  const blendStart = next.atMs - blendMs;
  if (timeMs < blendStart) return pose;
  const previousOpen = pose.open;
  const previousWide = pose.wide;
  const previousRound = pose.round;
  const nextShape = SHAPES[next.shape];
  const nextWeight = clamp01(next.weight ?? 1);
  const nextOpen = REST.open + (nextShape.open - REST.open) * nextWeight;
  const nextWide = REST.wide + (nextShape.wide - REST.wide) * nextWeight;
  const nextRound = nextShape.round * nextWeight;
  const t = smooth((timeMs - blendStart) / blendMs);
  pose.open = previousOpen + (nextOpen - previousOpen) * t;
  pose.wide = previousWide + (nextWide - previousWide) * t;
  pose.round = previousRound + (nextRound - previousRound) * t;
  return pose;
}

/** Preserve an authored-voice cue while keeping the jaw still between audio. */
export const RESTING_VOICE_CLOCK: CinematicVoiceClock = {
  currentTimeMs: () => 0,
  sample: (out = { open: REST.open, wide: REST.wide, round: REST.round }) => {
    out.open = REST.open;
    out.wide = REST.wide;
    out.round = REST.round;
    return out;
  },
};

export function validateVisemeTrack(track: readonly TimedViseme[], durationMs: number): string[] {
  const issues: string[] = [];
  if (!Number.isFinite(durationMs) || durationMs <= 0) issues.push("durationMs must be positive");
  if (track.length < 2) issues.push("at least two viseme cues are required");
  if (track.length && track[0]!.atMs !== 0) issues.push("the first cue must start at 0ms");
  let previous = -1;
  for (const [index, cue] of track.entries()) {
    if (!Number.isFinite(cue.atMs) || cue.atMs < 0 || cue.atMs > durationMs) {
      issues.push(`cue ${index} is outside the clip duration`);
    }
    if (cue.atMs <= previous) issues.push(`cue ${index} is not strictly ordered`);
    if (
      cue.weight !== undefined &&
      (!Number.isFinite(cue.weight) || cue.weight < 0 || cue.weight > 1)
    ) {
      issues.push(`cue ${index} has an invalid weight`);
    }
    previous = cue.atMs;
  }
  if (track.length && track.at(-1)!.shape !== "silence") {
    issues.push("the final cue must return to silence");
  }
  return issues;
}

/** Tie visual cues to the audio clock, including a resumed media element offset. */
export function voiceClockFromContext(
  context: AudioContextClock,
  startedAtSeconds: number,
  offsetMs: number,
  track: readonly TimedViseme[],
): CinematicVoiceClock {
  const currentTimeMs = () =>
    Math.max(0, offsetMs + (context.currentTime - startedAtSeconds) * 1000);
  return {
    currentTimeMs,
    sample: (out) => sampleVisemeAt(track, currentTimeMs(), out),
  };
}
