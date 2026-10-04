import type { CutsceneLine, SceneMood, Speaker } from "@/content/cutscenes";
import type { LineDirection } from "./cutscene-director";
import { estimateLineDuration } from "./cutscene-timeline";
import type { CutsceneChoiceReaction } from "./cutscene-choice";

export type CinematicGesture =
  "explain" | "question" | "rally" | "reassure" | "confront" | "celebrate";

export type CinematicDialogueTurnKind =
  "opening" | "reply" | "question" | "support" | "challenge" | "decision";

/** A handoff makes the non-speaking actor answer the line without competing
 * with the speaking gesture. It is derived at render time and is never saved. */
export interface CinematicDialogueTurn {
  kind: CinematicDialogueTurnKind;
  previousSpeaker: Speaker | null;
  listener: Speaker | null;
  listenerReaction: number;
  relationship?: CutsceneChoiceReaction["relationship"] | undefined;
}

export interface CinematicDialogueContext {
  previousLine?: CutsceneLine | undefined;
  choiceReaction?: CutsceneChoiceReaction | undefined;
}

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
  /** The current conversational handoff, when a prior speaker is known. */
  turn?: CinematicDialogueTurn | undefined;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function hasAny(text: string, terms: readonly string[]) {
  return terms.some((term) => text.includes(term));
}

function dialogueTurnFor(
  line: CutsceneLine,
  previousLine: CutsceneLine | undefined,
  gesture: CinematicGesture,
  decision: boolean,
  reaction: CutsceneChoiceReaction | undefined,
): CinematicDialogueTurn | undefined {
  const previousSpeaker = previousLine?.who ?? null;
  const conversationalPrevious =
    previousSpeaker &&
    previousSpeaker !== line.who &&
    previousSpeaker !== "narrator" &&
    line.who !== "narrator"
      ? previousSpeaker
      : null;
  const listener =
    conversationalPrevious ??
    (reaction?.responder && reaction.responder !== line.who ? reaction.responder : null);
  if (!listener && !decision) return undefined;

  const text = line.text.toLocaleLowerCase("pt-BR");
  const challenges =
    gesture === "confront" ||
    hasAny(text, ["mas", "porém", "porem", "discord", "não aceito", "nao aceito", "cobrar"]);
  const supports =
    gesture === "reassure" ||
    hasAny(text, ["entendo", "junto", "confio", "calma", "apoio", "respeito"]);
  const kind: CinematicDialogueTurnKind = decision
    ? "decision"
    : challenges || reaction?.relationship === "strained"
      ? "challenge"
      : supports || reaction?.relationship === "connected"
        ? "support"
        : gesture === "question"
          ? "question"
          : conversationalPrevious
            ? "reply"
            : "opening";
  const listenerReaction = clamp01(
    reaction
      ? 0.22 +
          reaction.receptivity * 0.48 +
          (kind === "support" ? 0.14 : 0) +
          (kind === "challenge" ? 0.08 : 0)
      : conversationalPrevious
        ? kind === "support"
          ? 0.62
          : kind === "challenge"
            ? 0.52
            : 0.42
        : decision
          ? 0.32
          : 0,
  );
  return {
    kind,
    previousSpeaker,
    listener,
    listenerReaction,
    ...(reaction ? { relationship: reaction.relationship } : {}),
  };
}

/** A short gesture has a readable preparation, stroke and recovery. The
 * proportions differ by intent so every sentence does not use the same arm
 * loop: reassurance stays longer in the held pose while confrontation lands
 * earlier and returns quickly. */
function gestureEnvelope(phase: number, gesture: CinematicGesture) {
  const u = clamp01(phase);
  const timing: readonly [prepare: number, holdEnd: number, recovery: number] =
    gesture === "reassure"
      ? [0.26, 0.62, 0.34]
      : gesture === "question"
        ? [0.18, 0.6, 0.34]
        : gesture === "confront"
          ? [0.12, 0.44, 0.3]
          : gesture === "rally"
            ? [0.15, 0.66, 0.27]
            : gesture === "celebrate"
              ? [0.13, 0.72, 0.25]
              : [0.2, 0.56, 0.34];
  const [prepare, holdEnd, recovery] = timing;
  const smooth = (value: number) => {
    const eased = clamp01(value);
    return eased * eased * (3 - 2 * eased);
  };
  if (u < prepare) return smooth(u / prepare);
  if (u < holdEnd) return 1;
  return 1 - smooth((u - holdEnd) / recovery);
}

export function cinematicPhrases(text: string, duration: number) {
  const safeDuration = Math.max(1.7, Number.isFinite(duration) ? duration : 1.7);
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
    const span = (safeDuration * weights[index]!) / total;
    const start = cursor;
    cursor += span;
    const rest = /[.!?…]$/u.test(part) ? 0.24 : /[,;:]$/u.test(part) ? 0.16 : 0.07;
    return {
      start,
      end: Math.max(start + span * 0.65, cursor - Math.min(rest, span * 0.3)),
      emphasis: /[!?]/u.test(part) ? 1 : /[,;:]$/u.test(part) ? 0.78 : index % 2 ? 0.7 : 0.88,
    };
  });
}

/** The actual branch text directs the performance, including inserted replies. */
export function cinematicCueFor(
  id: string,
  line: CutsceneLine,
  direction: LineDirection,
  mood: SceneMood,
  dialogue?: CinematicDialogueContext,
): CinematicCue {
  const text = line.text.toLocaleLowerCase("pt-BR");
  const celebrates = hasAny(text, [
    "taça",
    "taca",
    "título",
    "titulo",
    "campe",
    "conquist",
    "vitória",
    "vitoria",
    "gol",
    "festa",
  ]);
  const confronts = hasAny(text, [
    "não aceito",
    "nao aceito",
    "culpa",
    "cobran",
    "erro",
    "demissão",
    "demissao",
    "vergonha",
    "responsab",
    "ultimato",
    "crise",
  ]);
  const rallies = hasAny(text, [
    "juntos",
    "grupo",
    "vamos",
    "lutar",
    "acredito",
    "vencer",
    "campo",
    "reagir",
    "força",
    "forca",
    "unidos",
  ]);
  const reassures = hasAny(text, [
    "calma",
    "confio",
    "cuidar",
    "obrigad",
    "apoio",
    "tranquil",
    "recuper",
    "tempo",
    "respira",
  ]);
  const gesture: CinematicGesture =
    line.who === "press" || text.includes("?")
      ? "question"
      : celebrates && direction.emotion.warmth > 0.45
        ? "celebrate"
        : confronts || direction.emotion.tension > 0.7
          ? "confront"
          : rallies
            ? "rally"
            : reassures
              ? "reassure"
              : "explain";
  const duration = estimateLineDuration(line);
  const decision = Boolean(line.choices?.length);
  const reaction = dialogue?.choiceReaction;
  const turn = dialogueTurnFor(line, dialogue?.previousLine, gesture, decision, reaction);
  const tension = reaction
    ? clamp01(direction.emotion.tension * 0.66 + reaction.tension * 0.34)
    : direction.emotion.tension;
  const warmth = reaction
    ? clamp01(direction.emotion.warmth * 0.66 + reaction.warmth * 0.34)
    : direction.emotion.warmth;
  return {
    id,
    speaker: line.who,
    gesture,
    mood,
    tension,
    warmth,
    duration,
    decision,
    phrases: cinematicPhrases(line.text, duration),
    ...(turn ? { turn } : {}),
  };
}

/** Preparation, stroke, held emphasis, recovery and a quiet listening tail. */
export function cinematicGestureAt(time: number, cue: CinematicCue, seed: number) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  const length = Math.max(1.7, Number.isFinite(cue.duration) ? cue.duration : 1.7);
  const speaking = t < length;
  const safeSeed = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  const cycle = 2.8 + (Math.abs(safeSeed) % 3) * 0.22;
  const phrases = cue.phrases;
  const phraseIndex =
    phrases?.findIndex(
      (part) =>
        Number.isFinite(part.start) &&
        Number.isFinite(part.end) &&
        part.end > part.start &&
        t >= part.start &&
        t < part.end,
    ) ?? -1;
  const part = phraseIndex >= 0 ? phrases?.[phraseIndex] : undefined;
  const phrase = part
    ? clamp01((t - part.start) / Math.max(0.1, part.end - part.start))
    : (t % cycle) / cycle;
  const smooth = (x: number) => {
    const u = Math.max(0, Math.min(1, x));
    return u * u * (3 - 2 * u);
  };
  const delivering = speaking && (!phrases?.length || Boolean(part));
  const ending = 1 - smooth((t - length + 0.6) / 0.6);
  const emphasis = clamp01(part?.emphasis ?? 1);
  const weight = delivering ? clamp01(gestureEnvelope(phrase, cue.gesture) * ending * emphasis) : 0;
  const syllable = Math.max(0, Math.sin(t * 15.4) * 0.6 + Math.sin(t * 23.1) * 0.3);
  const accent = cue.gesture === "confront" ? 1.18 : cue.gesture === "reassure" ? 0.72 : 1;
  const nodStrength =
    cue.gesture === "rally"
      ? 0.055
      : cue.gesture === "question"
        ? -0.035
        : cue.gesture === "reassure"
          ? 0.025
          : 0.04;
  return {
    weight,
    speaking,
    jaw: delivering ? syllable * 0.065 * Math.min(1, phrase * 8, (1 - phrase) * 8) : 0,
    nod: Math.sin(t * 2.1) * weight * nodStrength * accent,
    side: (Math.max(0, phraseIndex) + safeSeed) % 2 ? 1 : -1,
    phase: !delivering
      ? "rest"
      : phrase < 0.2
        ? "preparation"
        : phrase < 0.52
          ? "emphasis"
          : "recovery",
  };
}
