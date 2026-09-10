/**
 * Ajustes visuais escolhidos pelo usuário na página /visual.
 *
 * Ficam salvos no navegador (localStorage) e são lidos tanto pelo estádio 3D
 * quanto pela "cara" da partida (clima, horário e corte do gramado).
 */
import { useEffect, useState } from "react";

import type { MowPattern } from "@/components/game/stadium/textures/grass";
import type { TimeOfDay, Weather } from "@/game/matchday";

export type Auto<T extends string> = "auto" | T;

export interface VisualSettings {
  /** riqueza das texturas do gramado, concreto e uniformes */
  textureDetail: "baixa" | "media" | "alta";
  /** densidade de grama 3D (0 = sem tufos, 1.5 = bem denso) */
  grassDensity: number;
  /** geometria dos jogadores: mais simples = mais fluido */
  playerDetail: "simples" | "padrao" | "detalhado";
  /** densidade da torcida (0.2 a 1.5) */
  crowdDensity: number;
  /** clima e horário fixos ou sorteados por partida */
  weather: Auto<Weather>;
  time: Auto<TimeOfDay>;
  /** corte de grama padrão e por clube */
  mow: Auto<MowPattern>;
  mowByClub: Record<string, MowPattern>;
  /** pós-processamento (brilho, foco, granulado) */
  postFx: boolean;
}

export const DEFAULT_VISUAL: VisualSettings = {
  textureDetail: "alta",
  grassDensity: 1,
  playerDetail: "padrao",
  crowdDensity: 1,
  weather: "auto",
  time: "auto",
  mow: "auto",
  mowByClub: {},
  postFx: true,
};

const KEY = "manager3d.visual.v1";

let cache: VisualSettings | null = null;
const listeners = new Set<(v: VisualSettings) => void>();

export function getVisual(): VisualSettings {
  if (cache) return cache;
  if (typeof localStorage === "undefined") return DEFAULT_VISUAL;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_VISUAL, ...(JSON.parse(raw) as Partial<VisualSettings>) } : DEFAULT_VISUAL;
  } catch {
    cache = DEFAULT_VISUAL;
  }
  return cache;
}

export function setVisual(patch: Partial<VisualSettings>) {
  const next = { ...getVisual(), ...patch };
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* modo privado: só não persiste */
  }
  for (const l of listeners) l(next);
  return next;
}

export function resetVisual() {
  return setVisual(DEFAULT_VISUAL);
}

/** Assina mudanças (usado pelo React e pelo estádio). */
export function subscribeVisual(fn: (v: VisualSettings) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Hook: devolve os ajustes atuais e re-renderiza quando mudam. */
export function useVisual(): VisualSettings {
  const [v, setV] = useState<VisualSettings>(() => getVisual());
  useEffect(() => subscribeVisual(setV), []);
  return v;
}

/** Multiplicador de densidade aplicado às malhas instanciadas. */
export function densityScale(v: VisualSettings) {
  return {
    grass: Math.max(0, v.grassDensity),
    crowd: Math.max(0.1, v.crowdDensity),
    texture: v.textureDetail === "alta" ? 1 : v.textureDetail === "media" ? 0.6 : 0.3,
  };
}
