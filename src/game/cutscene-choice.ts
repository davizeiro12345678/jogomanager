import type { ChoiceEffect, CutsceneChoice, CutsceneLine, Speaker } from "@/content/cutscenes";
import type { PlayerRelationship } from "./career-world-types";
import type { Personality } from "./types";

/**
 * A transient reading of the player who is most likely to answer a choice.
 * This deliberately mirrors only data already held in a career save. It is
 * never written back by the cutscene renderer: authoritative consequences
 * still belong to the caller through `ChoiceEffect`.
 */
export interface CutsceneChoiceParticipant {
  /** Stable roster id when this role represents a real career player. */
  playerId?: string | undefined;
  relationship?: Pick<PlayerRelationship, "trust" | "respect"> | undefined;
  personality?: Personality | undefined;
}

/** Optional, normalized-at-read-time context supplied by a career host. */
export interface CutsceneChoiceContext {
  participants?: Partial<Record<Speaker, CutsceneChoiceParticipant | undefined>> | undefined;
  /** Useful for custom scenes whose responding role is not part of the fixed cast. */
  defaultParticipant?: CutsceneChoiceParticipant | undefined;
}

export type CutsceneRelationshipTone = "connected" | "measured" | "guarded" | "strained";

/**
 * Result of reading a choice through a relationship. The values tune the
 * inserted dialogue's cue and describe a deliberately small player outcome;
 * the caller remains responsible for deciding whether it reaches a save.
 */
export interface CutsceneChoiceReaction {
  /** Stable authored key used to make a persisted reaction idempotent. */
  decisionId: string;
  responder: Speaker;
  playerId?: string | undefined;
  personality?: Personality | undefined;
  trust: number;
  respect: number;
  receptivity: number;
  /** 0..1: willingness to back the message after relationship/personality. */
  support: number;
  /** 0..1: bounded resistance to the message. */
  resistance: number;
  /** Individual morale adjustment, intentionally constrained to -3..3. */
  moraleDelta: number;
  /** Relationship adjustments are constrained so one scene cannot rewrite a save. */
  trustDelta: number;
  respectDelta: number;
  warmth: number;
  tension: number;
  relationship: CutsceneRelationshipTone;
}

export interface CutsceneBranch {
  lines: CutsceneLine[];
  effect: ChoiceEffect | undefined;
  reaction?: CutsceneChoiceReaction | undefined;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampScore = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : fallback;
const clampDelta = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, Math.round(Number.isFinite(value) ? value : 0)));
const stableId = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : fallback.slice(0, 120);

const PERSONALITIES = new Set<Personality>([
  "líder",
  "profissional",
  "ambicioso",
  "temperamental",
  "caseiro",
  "determinado",
]);

function personalityOf(value: unknown): Personality | undefined {
  return typeof value === "string" && PERSONALITIES.has(value as Personality)
    ? (value as Personality)
    : undefined;
}

function playerIdOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : undefined;
}

function choiceIntent(choice: CutsceneChoice) {
  const text =
    `${choice.label} ${choice.hint ?? ""} ${choice.effect?.headline ?? ""}`.toLocaleLowerCase(
      "pt-BR",
    );
  const includes = (terms: readonly string[]) => terms.some((term) => text.includes(term));
  const forceful = includes([
    "provoc",
    "peitar",
    "autoridade",
    "azedar",
    "cobrar",
    "exigir",
    "multar",
    "hierarquia",
    "ultimato",
    "pressão",
    "pressao",
    "dono",
    "arriscar",
    "sacrifício",
    "sacrificio",
    "infiltra",
  ]);
  const supportive = includes([
    "respeit",
    "calma",
    "proteger",
    "apoio",
    "confi",
    "cuidar",
    "conversa",
    "pacien",
    "seguro",
    "poupar",
    "saúde",
    "saude",
    "garantir",
    "minutos",
    "renov",
  ]);
  const ambitious = includes([
    "título",
    "titulo",
    "vencer",
    "ganhar",
    "meta",
    "vitória",
    "vitoria",
    "renov",
    "salário",
    "salario",
    "titular",
    "minutos",
  ]);
  const pressure = Math.max(0, choice.effect?.pressure ?? 0);
  const morale = choice.effect?.morale ?? 0;
  return {
    force: clamp01((forceful ? 0.72 : 0.18) + pressure * 0.04),
    support: clamp01((supportive ? 0.78 : 0.24) + Math.max(0, morale) * 0.035),
    ambition: clamp01((ambitious ? 0.72 : 0.18) + Math.max(0, choice.effect?.approval ?? 0) * 0.03),
  };
}

function participantFor(
  lines: readonly CutsceneLine[],
  lineIndex: number,
  choice: CutsceneChoice,
  context: CutsceneChoiceContext | undefined,
) {
  if (!context) return null;
  const candidates = [
    ...choice.response.map((line) => line.who),
    lines[lineIndex - 1]?.who,
    lines[lineIndex]?.who,
  ].filter(
    (speaker): speaker is Speaker =>
      Boolean(speaker) && speaker !== "manager" && speaker !== "narrator",
  );
  const participants = context.participants;
  for (const responder of candidates) {
    const participant = participants?.[responder];
    if (participant) return { responder, participant };
  }
  const responder = candidates[0];
  return context.defaultParticipant && responder
    ? { responder, participant: context.defaultParticipant }
    : null;
}

/**
 * Reads an authored choice against a live relationship without changing any
 * save data. Hosts can omit context entirely (for previews and custom scenes)
 * and receive the legacy branch behaviour.
 */
export function cutsceneChoiceReactionFor(
  lines: readonly CutsceneLine[],
  lineIndex: number,
  choiceIndex: number,
  context?: CutsceneChoiceContext,
): CutsceneChoiceReaction | undefined {
  const choice = lines[lineIndex]?.choices?.[choiceIndex];
  if (!choice) return undefined;
  const matched = participantFor(lines, lineIndex, choice, context);
  if (!matched) return undefined;

  const trust = clampScore(matched.participant.relationship?.trust, 55);
  const respect = clampScore(matched.participant.relationship?.respect, 50);
  const personality = personalityOf(matched.participant.personality);
  const playerId = playerIdOf(matched.participant.playerId);
  const intent = choiceIntent(choice);
  const connection = ((trust - 50) * 0.56 + (respect - 50) * 0.44) / 100;
  let compatibility = 0;
  switch (personality) {
    case "líder":
      compatibility = intent.support * 0.18 + intent.force * 0.05;
      break;
    case "profissional":
      compatibility = intent.force * 0.12 + intent.support * 0.08;
      break;
    case "ambicioso":
      compatibility = intent.ambition * 0.2 + intent.force * 0.04;
      break;
    case "temperamental":
      compatibility = intent.support * 0.18 - intent.force * 0.22;
      break;
    case "caseiro":
      compatibility = intent.support * 0.19 - intent.force * 0.07;
      break;
    case "determinado":
      compatibility = intent.force * 0.14 + intent.ambition * 0.1;
      break;
    default:
      compatibility = intent.support * 0.06;
  }
  const receptivity = clamp01(0.5 + connection * 0.78 + compatibility - intent.force * 0.06);
  const personalitySupport =
    personality === "caseiro" || personality === "líder"
      ? intent.support * 0.05
      : personality === "ambicioso"
        ? intent.ambition * 0.06
        : personality === "determinado"
          ? intent.force * 0.04
          : 0;
  const personalityResistance =
    personality === "temperamental"
      ? intent.force * 0.12
      : personality === "caseiro"
        ? intent.force * 0.035
        : 0;
  const support = clamp01(
    intent.support * 0.52 +
      intent.ambition * 0.14 +
      (1 - intent.force) * 0.08 +
      receptivity * 0.45 +
      personalitySupport,
  );
  const resistance = clamp01(intent.force * 0.4 + (1 - receptivity) * 0.5 + personalityResistance);
  const response = support - resistance;
  const moraleDelta = clampDelta(response * 3, 3);
  const trustDelta = clampDelta(response * 4, 4);
  const respectBias =
    intent.force *
    (personality === "profissional" || personality === "determinado"
      ? 0.45
      : personality === "temperamental"
        ? -0.45
        : 0.08);
  const respectDelta = clampDelta(
    (receptivity - 0.5) * 1.5 + respectBias + intent.support * 0.2,
    2,
  );
  const warmth = clamp01(0.16 + receptivity * 0.62 + intent.support * 0.18 - intent.force * 0.08);
  const tension = clamp01(
    0.1 + (1 - receptivity) * 0.58 + intent.force * 0.18 - intent.support * 0.12,
  );
  const relationship: CutsceneRelationshipTone =
    receptivity >= 0.76
      ? "connected"
      : receptivity >= 0.5
        ? "measured"
        : receptivity >= 0.3
          ? "guarded"
          : "strained";
  return {
    decisionId: stableId(
      choice.id,
      `${lines[lineIndex]?.id ?? `line-${lineIndex}`}:choice-${choiceIndex}`,
    ),
    responder: matched.responder,
    ...(playerId ? { playerId } : {}),
    personality,
    trust,
    respect,
    receptivity,
    support,
    resistance,
    moraleDelta,
    trustDelta,
    respectDelta,
    warmth,
    tension,
    relationship,
  };
}

/** Insert a branch once, without replacing later dialogue or changing the
 * authored script. The career caller remains the owner of any consequences. */
export function cutsceneBranch(
  lines: readonly CutsceneLine[],
  lineIndex: number,
  choiceIndex: number,
  context?: CutsceneChoiceContext,
): CutsceneBranch | null {
  const choice = lines[lineIndex]?.choices?.[choiceIndex];
  if (!choice) return null;
  const reaction = cutsceneChoiceReactionFor(lines, lineIndex, choiceIndex, context);
  return {
    lines: [...lines.slice(0, lineIndex + 1), ...choice.response, ...lines.slice(lineIndex + 1)],
    effect: choice.effect,
    ...(reaction ? { reaction } : {}),
  };
}
