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
  /** Speech groups retain punctuation rests and avoid a repeating arm loop. */
  phrases?: readonly { start: number; end: number; emphasis: number }[];
}

export function cinematicPhrases(text: string, duration: number) {
  const groups = text.match(/[^,;:.!?…]+[,;:.!?…]*/gu) ?? [text];
  const parts = groups.flatMap((group) => {
    const words = group.trim().split(/\s+/u).filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 7) chunks.push(words.slice(i, i + 7).join(" "));
    return chunks;
  });
  const weights = parts.map((part) => Math.max(1, part.replace(/[^\p{L}\p{N}]/gu, "").length));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = 0;
  return parts.map((part, index) => {
    const span = (Math.max(1.7, duration) * weights[index]!) / total;
    const start = cursor;
    cursor += span;
    const rest = /[.!?…]$/u.test(part) ? 0.24 : /[,;:]$/u.test(part) ? 0.16 : 0.07;
    return {
      start,
      end: Math.max(start + span * 0.65, cursor - Math.min(rest, span * 0.3)),
      emphasis: /[!?]/u.test(part) ? 1 : index % 2 ? 0.7 : 0.88,
    };
  });
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
  const duration = estimateLineDuration(line);
  return {
    id,
    speaker: line.who,
    gesture,
    mood,
    tension: direction.emotion.tension,
    warmth: direction.emotion.warmth,
    duration,
    decision: Boolean(line.choices?.length),
    phrases: cinematicPhrases(line.text, duration),
  };
}

/** Preparation, stroke, held emphasis, recovery and a quiet listening tail. */
export function cinematicGestureAt(time: number, cue: CinematicCue, seed: number) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  const length = Math.max(1.7, cue.duration);
  const speaking = t < length;
  const cycle = 2.8 + (seed % 3) * 0.22;
  const phrases = cue.phrases;
  const phraseIndex = phrases?.findIndex((part) => t >= part.start && t < part.end) ?? -1;
  const part = phraseIndex >= 0 ? phrases?.[phraseIndex] : undefined;
  const phrase = part
    ? (t - part.start) / Math.max(0.1, part.end - part.start)
    : (t % cycle) / cycle;
  const smooth = (x: number) => {
    const u = Math.max(0, Math.min(1, x));
    return u * u * (3 - 2 * u);
  };
  const delivering = speaking && (!phrases?.length || Boolean(part));
  const weight = delivering
    ? (phrase < 0.2
        ? smooth(phrase / 0.2)
        : phrase < 0.52
          ? 1
          : 1 - smooth((phrase - 0.52) / 0.3)) *
      (1 - smooth((t - length + 0.6) / 0.6)) *
      (part?.emphasis ?? 1)
    : 0;
  const syllable = Math.max(0, Math.sin(t * 15.4) * 0.6 + Math.sin(t * 23.1) * 0.3);
  return {
    weight,
    speaking,
    jaw: delivering ? syllable * 0.065 * Math.min(1, phrase * 8, (1 - phrase) * 8) : 0,
    nod: Math.sin(t * 2.1) * weight * 0.035,
    side: (Math.max(0, phraseIndex) + seed) % 2 ? 1 : -1,
    phase: !delivering
      ? "rest"
      : phrase < 0.2
        ? "preparation"
        : phrase < 0.52
          ? "emphasis"
          : "recovery",
  };
}
