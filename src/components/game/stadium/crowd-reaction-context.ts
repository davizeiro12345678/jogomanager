// ============================================================================
//  CrowdReaction.tsx
//  Reação da torcida ao que acontece em campo.
//
//  A torcida do projeto já tem geometria, sway e pulso de gol
//  (`CrowdLod`). Este módulo não mexe nisso: ele acrescenta a CAMADA DE
//  REAÇÃO — o que a arquibancada faz em cada tipo de lance:
//
//   - gol            → erupção: flashes de celular, fumaça, bandeiras;
//   - chance clara   → suspiro: flashes esparsos e um "ahhh" visual (brilho);
//   - falta/cartão   → protesto: agito curto e denso;
//   - bola no ataque → zumbido: brilho baixo e constante.
//
//  Custo: 3 nuvens de pontos + 6 sprites de fumaça, todos reciclados. Nenhum
//  objeto é criado durante a partida — o lixo de memória derruba o quadro mais
//  do que qualquer shader.
// ============================================================================

import { createContext, useContext } from "react";

import type React from "react";

export type CrowdMood = "idle" | "buzz" | "chance" | "erupt" | "protest";

export interface CrowdReactionState {
  mood: CrowdMood;
  /** 0 a 1, decai sozinho */
  intensity: number;
  /** lado que provocou a reação ("home" = a favor do mandante) */
  side: "home" | "away";
  /** minuto do último evento que gerou reação */
  since: number;
}

export const EMPTY: CrowdReactionState = { mood: "idle", intensity: 0, side: "home", since: 0 };

/** Contexto para outros subsistemas (câmera, narração) lerem o clima da torcida. */
export const CrowdReactionContext = createContext<React.MutableRefObject<CrowdReactionState>>({
  current: EMPTY,
});

export function useCrowdReaction(): React.MutableRefObject<CrowdReactionState> {
  return useContext(CrowdReactionContext);
}
