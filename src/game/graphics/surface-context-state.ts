// ============================================================================
//  surface-context.tsx
//  Estado de superfície dos atletas compartilhado pela cena.
//
//  Os materiais são compartilhados entre atletas (ver `player-materials.ts`),
//  então a evolução de suor/grama/chuva precisa chegar a todos ao mesmo tempo e
//  em degraus estáveis — se cada atleta calculasse o seu, o cache de materiais
//  explodiria em dezenas de programas de shader.
//
//  O provedor amostra o relógio de jogo ~1 vez por segundo e só avisa o React
//  quando o DEGRAU muda (no máximo 3 × 3 × 2 combinações), nunca por segundo.
// ============================================================================

import { createContext, useContext } from "react";

import { type SurfaceState, type SurfaceSteps } from "@/game/graphics/player-surface";

export const DEFAULT_STEPS: SurfaceSteps = { sweat: 0, dirt: 0, wet: 0 };

export const SurfaceContext = createContext<SurfaceSteps>(DEFAULT_STEPS);

export const SurfaceStateContext = createContext<SurfaceState>({
  sweat: 0,
  dirt: 0,
  wet: 0,
  fatigue: 0,
});

/** Degraus de superfície para entrar na chave do cache de materiais. */
export function useMatchSurface(): SurfaceSteps {
  return useContext(SurfaceContext);
}

/** Estado contínuo, para HUD e diagnóstico. */
export function useMatchSurfaceState(): SurfaceState {
  return useContext(SurfaceStateContext);
}
