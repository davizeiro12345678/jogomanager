// ============================================================================
//  choice-effects.ts
//  Aplica a consequência de uma escolha de cutscene na carreira.
//
//  Efeitos somam nos medidores (com trava 0..100) e a manchete vira notícia.
//  "morale" aqui é a média do elenco — aplicada jogador a jogador para o
//  vestiário sentir junto.
// ============================================================================

import type { ChoiceEffect } from "@/content/cutscenes";
import type { CutsceneChoiceReaction } from "./cutscene-choice";
import type { CareerState, NewsItem } from "./types";
import { applyInterviewDecision, rememberWorldEvent, worldClamp, worldFor } from "./career-world";

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const boundedDelta = (value: unknown, limit: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(-limit, Math.min(limit, Math.round(value)))
    : 0;
const boundedScore = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const boundedId = (value: unknown, max = 120) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

/**
 * A cutscene may describe a reaction without changing the save. When the host
 * supplied a real roster id, persist only a small, once-per-round response for
 * that player. The authored `ChoiceEffect` stays the source of all public
 * club, board and crowd consequences.
 */
function applyChoiceReaction(
  state: CareerState,
  reaction: CutsceneChoiceReaction | undefined,
): CareerState {
  const playerId = boundedId(reaction?.playerId, 100);
  if (!reaction || !playerId) return state;
  const player = state.players[playerId];
  if (!player || player.clubId !== state.clubId) return state;

  const decisionId = boundedId(reaction.decisionId) ?? "choice";
  const key =
    `cutscene:${state.clubId}:${state.season}:${state.round}:${decisionId}:${playerId}`.slice(
      0,
      180,
    );
  const world = worldFor(state);
  if (world.applied.includes(key)) return state;

  const moraleDelta = boundedDelta(reaction.moraleDelta, 3);
  const trustDelta = boundedDelta(reaction.trustDelta, 4);
  const respectDelta = boundedDelta(reaction.respectDelta, 2);
  if (!moraleDelta && !trustDelta && !respectDelta) return state;

  const support = boundedScore(reaction.support);
  const resistance = boundedScore(reaction.resistance);
  const receptive = support >= resistance;
  const next = rememberWorldEvent(state, {
    id: key,
    kind: "relationship",
    title: `Reação de ${player.name}`,
    detail: receptive
      ? `${player.name} recebeu a decisão como uma mensagem coerente e reforça a confiança no trabalho.`
      : `${player.name} reagiu com resistência à decisão e vai observar os próximos passos do treinador.`,
    sentiment: moraleDelta + trustDelta,
    playerId,
    bond: trustDelta,
    morale: moraleDelta,
    weight: 46,
  });
  const updated = worldFor(next);
  const bond = updated.relationships[playerId];
  if (!bond) return next;
  return {
    ...next,
    world: {
      ...updated,
      relationships: {
        ...updated.relationships,
        [playerId]: {
          ...bond,
          respect: worldClamp(bond.respect + respectDelta),
          lastTalk: `${state.clubId}:${state.season}:${state.round}`,
        },
      },
    },
  };
}

export function applyChoiceEffect(
  state: CareerState,
  effect: ChoiceEffect,
  reaction?: CutsceneChoiceReaction,
): CareerState {
  if (effect.careerDecision) {
    const next = applyInterviewDecision(state, effect.careerDecision);
    return next === state ? next : applyChoiceReaction(next, reaction);
  }
  const players = { ...state.players };
  if (effect.morale || effect.condition) {
    for (const [id, p] of Object.entries(players)) {
      if (p.clubId !== state.clubId) continue;
      players[id] = {
        ...p,
        morale: clamp(p.morale + (effect.morale ?? 0)),
        condition: clamp(p.condition + (effect.condition ?? 0)),
      };
    }
  }
  const news: NewsItem[] = [...state.news];
  if (effect.headline) {
    news.unshift({
      id: `escolha-${state.season}-${state.round}-${Date.now() % 100000}`,
      season: state.season,
      round: state.round,
      kind: "vestiario",
      title: effect.headline,
      body: "Sua decisão na conversa repercute no clube.",
    });
  }
  return applyChoiceReaction(
    {
      ...state,
      players,
      approval: clamp(state.approval + (effect.approval ?? 0)),
      fanApproval: clamp((state.fanApproval ?? 60) + (effect.fanApproval ?? 0)),
      pressure: clamp((state.pressure ?? 25) + (effect.pressure ?? 0)),
      news: news.slice(0, 60),
    },
    reaction,
  );
}
