// ============================================================================
//  player-surface.ts
//  Estado da superfície dos atletas ao longo da partida.
//
//  Camisa limpa no minuto 0 e camisa suja de grama no minuto 80 são dois
//  materiais diferentes — e é esse contraste que faz a partida "acontecer" na
//  tela. O custo precisa ser zero em draw call, então a evolução é aplicada em
//  cima dos materiais COMPARTILHADOS (ver `player-materials.ts`) e quantizada
//  em degraus: o cache de materiais cresce no máximo 3× (não 90×) e nenhum
//  atleta ganha material próprio.
//
//  A quantização é a chave: `surfaceStep` devolve um número pequeno e estável
//  que entra na chave do cache. Sem ela, cada fração de segundo criaria um
//  material novo e o jogo afundaria em compilação de shader.
// ============================================================================

import * as THREE from "three";

/** Chuva ou gramado molhado deixam o tecido encharcado também. */
export type SurfaceWeather = "limpo" | "nublado" | "chuva" | "neve";

export interface SurfaceInputs {
  /** minuto de jogo (0 a 90+) */
  minute: number;
  weather: SurfaceWeather;
  /** intensidade do jogo: 0 treino, 1 clássico decisivo */
  intensity?: number;
  /** qualidade efetiva: em "baixa" o detalhe de superfície é desligado */
  quality?: "alta" | "media" | "baixa";
}

export interface SurfaceState {
  /** suor de 0 a 1 — brilho na pele e no tecido */
  sweat: number;
  /** grama/lama na camisa, de 0 a 1 */
  dirt: number;
  /** tecido encharcado, de 0 a 1 */
  wet: number;
  /** cansaço acumulado, escurece levemente o uniforme e baixa o viço */
  fatigue: number;
}

/** Degraus por canal: 3 níveis de suor × 3 de sujeira × 2 de chuva. */
const SWEAT_STEPS = 3;
const DIRT_STEPS = 3;
const WET_STEPS = 2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const step = (v: number, steps: number) =>
  Math.min(steps - 1, Math.max(0, Math.round(clamp01(v) * (steps - 1))));

/**
 * Evolução da superfície ao longo da partida.
 * Suor sobe rápido no começo e estabiliza; sujeira acumula devagar e só depois
 * do intervalo; chuva é imediata e constante.
 */
export function surfaceState({
  minute,
  weather,
  intensity = 1,
  quality = "alta",
}: SurfaceInputs): SurfaceState {
  if (quality === "baixa")
    return { sweat: 0, dirt: 0, wet: weather === "chuva" ? 0.5 : 0, fatigue: 0 };
  const m = Math.max(0, Math.min(120, minute));
  const progress = m / 90;
  const sweat = clamp01((0.18 + progress * 0.72) * (0.85 + intensity * 0.3));
  // sujeira: rara antes dos 20, visível depois dos 55, forte no fim
  const dirt = clamp01(Math.max(0, (m - 18) / 72) * (0.55 + intensity * 0.55));
  const wet =
    weather === "chuva"
      ? clamp01(0.62 + progress * 0.28)
      : weather === "neve"
        ? 0.22
        : weather === "nublado"
          ? 0.08
          : 0;
  const fatigue = clamp01(progress * (0.7 + intensity * 0.4));
  return { sweat, dirt, wet, fatigue };
}

/** Degraus quantizados — entram na chave do cache de materiais. */
export interface SurfaceSteps {
  sweat: number;
  dirt: number;
  wet: number;
}

export function surfaceSteps(state: SurfaceState): SurfaceSteps {
  return {
    sweat: step(state.sweat, SWEAT_STEPS),
    dirt: step(state.dirt, DIRT_STEPS),
    wet: step(state.wet, WET_STEPS),
  };
}

/**
 * Chave estável para o cache de materiais. Dois atletas no mesmo degrau
 * compartilham exatamente o mesmo material (e o mesmo programa de shader).
 */
export function surfaceKey(steps: SurfaceSteps): string {
  return `s${steps.sweat}d${steps.dirt}w${steps.wet}`;
}

/** Valor contínuo aproximado de um degrau (para reconstruir o estado do cache). */
export function stepValue(index: number, steps: number): number {
  return steps <= 1 ? 0 : index / (steps - 1);
}

export function surfaceFromSteps(steps: SurfaceSteps): SurfaceState {
  return {
    sweat: stepValue(steps.sweat, SWEAT_STEPS),
    dirt: stepValue(steps.dirt, DIRT_STEPS),
    wet: stepValue(steps.wet, WET_STEPS),
    fatigue: 0,
  };
}

/**
 * Mancha de grama: camisa perde saturação e ganha um tom terroso. Devolve uma
 * cor nova (não muta a original) para não contaminar o kit do clube.
 */
export function dirtTint(base: string, dirt: number): string {
  if (dirt <= 0) return base;
  const mud = new THREE.Color("#4a3b28");
  const out = new THREE.Color(base).lerp(mud, clamp01(dirt) * 0.42);
  return `#${out.getHexString()}`;
}

/** Uniforme cansado: levemente mais fosco e dessaturado. */
export function fatigueTint(base: string, fatigue: number): string {
  if (fatigue <= 0) return base;
  const out = new THREE.Color(base);
  const hsl = { h: 0, s: 0, l: 0 };
  out.getHSL(hsl);
  out.setHSL(hsl.h, Math.max(0, hsl.s - fatigue * 0.12), Math.max(0.04, hsl.l - fatigue * 0.03));
  return `#${out.getHexString()}`;
}

/**
 * Aplica o estado de superfície num material já criado. Só mexe em escalares
 * (roughness, clearcoat, sheen, cor): nenhuma recompilação de shader, nenhum
 * upload de textura — seguro para acontecer uma vez por segundo.
 */
export function applySurface(material: THREE.Material, state: SurfaceState): void {
  const { sweat, dirt, wet, fatigue } = state;
  const any = (m: unknown): m is THREE.MeshPhysicalMaterial =>
    typeof m === "object" && m !== null && "clearcoat" in (m as object);
  const std = material as THREE.MeshStandardMaterial;

  if (std.roughness !== undefined) {
    // suor e chuva baixam a rugosidade (brilho), sujeira e cansaço sobem
    std.roughness = clamp01(
      std.roughness - sweat * 0.12 - wet * 0.3 + dirt * 0.14 + fatigue * 0.04,
    );
  }
  if (std.envMapIntensity !== undefined) {
    std.envMapIntensity = clamp01(0.85 + wet * 0.5 + sweat * 0.12 - dirt * 0.18);
  }
  if (any(material)) {
    const physical = material as THREE.MeshPhysicalMaterial;
    if (physical.clearcoat !== undefined) {
      physical.clearcoat = clamp01((physical.clearcoat || 0) + wet * 0.45 + sweat * 0.1);
    }
    if (physical.clearcoatRoughness !== undefined) {
      physical.clearcoatRoughness = clamp01((physical.clearcoatRoughness || 0.5) - wet * 0.25);
    }
    if (physical.sheen !== undefined) {
      physical.sheen = clamp01((physical.sheen || 0) * (1 - wet * 0.45));
    }
  }
}

/** Aplica em todos os materiais de um atleta (camisa, calção, pele, meias). */
export function applySurfaceSet(
  materials: Record<string, THREE.Material | undefined>,
  state: SurfaceState,
): void {
  for (const material of Object.values(materials)) {
    if (material) applySurface(material, state);
  }
}

/** Resumo textual para o painel de FPS/diagnóstico. */
export function describeSurface(state: SurfaceState): string {
  const pct = (v: number) => `${Math.round(clamp01(v) * 100)}%`;
  return `suor ${pct(state.sweat)} · grama ${pct(state.dirt)} · molhado ${pct(state.wet)}`;
}
