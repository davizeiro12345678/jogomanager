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

import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import type React from "react";

import {
  surfaceKey,
  surfaceState,
  surfaceSteps,
  type SurfaceState,
  type SurfaceSteps,
  type SurfaceWeather,
} from "@/game/graphics/player-surface";
import type { SimView } from "@/game/sim";

const DEFAULT_STEPS: SurfaceSteps = { sweat: 0, dirt: 0, wet: 0 };

const SurfaceContext = createContext<SurfaceSteps>(DEFAULT_STEPS);
const SurfaceStateContext = createContext<SurfaceState>({
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

export const MatchSurfaceProvider = memo(function MatchSurfaceProvider({
  sim,
  weather,
  quality,
  intensity = 1,
  children,
}: {
  sim: SimView;
  weather: SurfaceWeather;
  quality: "alta" | "media" | "baixa";
  intensity?: number;
  children: React.ReactNode;
}) {
  const [steps, setSteps] = useState<SurfaceSteps>(DEFAULT_STEPS);
  const [state, setState] = useState<SurfaceState>(() =>
    surfaceState({ minute: 0, weather, intensity, quality }),
  );
  const lastKey = useRef(surfaceKey(DEFAULT_STEPS));

  useEffect(() => {
    // Uma amostra por segundo: suor não muda mais rápido que isso e cada
    // mudança de degrau custa material novo (e recompilação de shader).
    const tick = () => {
      const next = surfaceState({ minute: sim.minute(), weather, intensity, quality });
      const nextSteps = surfaceSteps(next);
      const key = surfaceKey(nextSteps);
      if (key === lastKey.current) return;
      lastKey.current = key;
      setSteps(nextSteps);
      setState(next);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sim, weather, intensity, quality]);

  return (
    <SurfaceContext.Provider value={steps}>
      <SurfaceStateContext.Provider value={state}>{children}</SurfaceStateContext.Provider>
    </SurfaceContext.Provider>
  );
});

export default MatchSurfaceProvider;
