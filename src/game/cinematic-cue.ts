import type { CutsceneLine, SceneMood, Speaker } from "@/content/cutscenes";
import type { LineDirection } from "./cutscene-director";
import { estimateLineDuration } from "./cutscene-timeline";

export type CinematicGesture =
  "explain" | "question" | "rally" | "reassure" | "confront" | "celebrate";
export interface CinematicCue {
  id: string;
  speaker: Speaker;
  gesture: CinematicGesture;
  mood: SceneMood;
  tension: number;
  warmth: number;
  duration: number;
  decision: boolean;
}

/** The actual branch text directs the performance, including inserted replies. */
export function cinematicCueFor(
  id: string,
  line: CutsceneLine,
  direction: LineDirection,
  mood: SceneMood,
): CinematicCue {
  const text = line.text.toLocaleLowerCase("pt-BR");
  const gesture: CinematicGesture =
    line.who === "press" || text.includes("?")
      ? "question"
      : direction.emotion.warmth > 0.65 && /taça|título|campe|conquist|vitória|gol/.test(text)
        ? "celebrate"
        : direction.emotion.tension > 0.6
          ? "confront"
          : /juntos|grupo|vamos|lutar|acredito|vencer|campo/.test(text)
            ? "rally"
            : /calma|confio|cuidar|obrigad|apoio|tranquil|recuper/.test(text)
              ? "reassure"
              : "explain";
  return {
    id,
    speaker: line.who,
    gesture,
    mood,
    tension: direction.emotion.tension,
    warmth: direction.emotion.warmth,
    duration: estimateLineDuration(line),
    decision: Boolean(line.choices?.length),
  };
}

/** Preparation, stroke, held emphasis, recovery and a quiet listening tail. */
export function cinematicGestureAt(time: number, cue: CinematicCue, seed: number) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  const length = Math.max(1.7, cue.duration);
  const speaking = t < length;
  const cycle = 2.8 + (seed % 3) * 0.22;
  const phrase = (t % cycle) / cycle;
  const smooth = (x: number) => {
    const u = Math.max(0, Math.min(1, x));
    return u * u * (3 - 2 * u);
  };
  const weight = speaking
    ? (phrase < 0.2
        ? smooth(phrase / 0.2)
        : phrase < 0.52
          ? 1
          : 1 - smooth((phrase - 0.52) / 0.3)) *
      (1 - smooth((t - length + 0.6) / 0.6))
    : 0;
  const syllable = Math.max(0, Math.sin(t * 15.4) * 0.6 + Math.sin(t * 23.1) * 0.3);
  return {
    weight,
    speaking,
    jaw: speaking ? syllable * 0.065 : 0,
    nod: Math.sin(t * 2.1) * weight * 0.035,
  };
}
