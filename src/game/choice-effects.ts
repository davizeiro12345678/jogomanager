// ============================================================================
//  choice-effects.ts
//  Aplica a consequência de uma escolha de cutscene na carreira.
//
//  Efeitos somam nos medidores (com trava 0..100) e a manchete vira notícia.
//  "morale" aqui é a média do elenco — aplicada jogador a jogador para o
//  vestiário sentir junto.
// ============================================================================

import type { ChoiceEffect } from "@/content/cutscenes";
import type { CareerState, NewsItem } from "./types";

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function applyChoiceEffect(state: CareerState, effect: ChoiceEffect): CareerState {
  const players = { ...state.players };
  if (effect.morale || effect.condition) {
    for (const [id, p] of Object.entries(players)) {
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
  return {
    ...state,
    players,
    approval: clamp(state.approval + (effect.approval ?? 0)),
    fanApproval: clamp((state.fanApproval ?? 60) + (effect.fanApproval ?? 0)),
    pressure: clamp((state.pressure ?? 25) + (effect.pressure ?? 0)),
    news: news.slice(0, 60),
  };
}
