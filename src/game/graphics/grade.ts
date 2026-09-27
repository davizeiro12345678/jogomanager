// ============================================================================
//  grade.ts
//  Correção de cor (grading) por clima, horário e momento da partida.
//
//  Em vez de empilhar mais passes de brilho/contraste/saturação — cada um é
//  uma leitura e uma escrita de tela inteira — geramos UMA textura 3D de 24³
//  (LUT) por combinação e deixamos o passe aplicar tudo de uma vez. Custo:
//  ~55 KB de dados e zero shader novo; o passe `LUT3DEffect` já vem com a
//  biblioteca de pós-processamento.
//
//  A curva é montada em cima do ACES que o renderer já aplica: ela só "pinta"
//  a imagem final (temperatura, contraste, matiz de sombra), nunca reexpõe.
// ============================================================================

import * as THREE from "three";

export type GradeTime = "dia" | "entardecer" | "noite";
export type GradeWeather = "limpo" | "nublado" | "chuva" | "neve";
export type GradeMoment = "match" | "replay" | "drama";

export interface GradeRecipe {
  /** ganho linear antes da curva (1 = neutro) */
  exposure: number;
  /** contraste em torno do cinza médio */
  contrast: number;
  /** 0 = preto e branco, 1 = neutro, >1 = saturado */
  saturation: number;
  /** cor jogada nas sombras (frio = azulado, quente = âmbar) */
  shadowTint: [number, number, number];
  /** cor jogada nos realces */
  highlightTint: [number, number, number];
  /** para onde puxar o branco: -1 frio, +1 quente */
  temperature: number;
  /** leve deslocamento verde/magenta (pele) */
  tint: number;
  /** gama das sombras: levanta detalhe sem lavar o preto */
  lift: number;
}

const NEUTRAL: [number, number, number] = [1, 1, 1];

/**
 * Receita base por horário. O padrão de transmissão é: dia neutro e levemente
 * frio, entardecer âmbar com sombras azuis, noite fria com realces quentes dos
 * refletores.
 */
const BY_TIME: Record<GradeTime, GradeRecipe> = {
  dia: {
    exposure: 1.0,
    contrast: 1.06,
    saturation: 1.05,
    shadowTint: [0.96, 0.98, 1.06],
    highlightTint: [1.02, 1.01, 0.98],
    temperature: -0.04,
    tint: 0,
    lift: 0.012,
  },
  entardecer: {
    exposure: 1.02,
    contrast: 1.12,
    saturation: 1.12,
    shadowTint: [0.94, 0.97, 1.12],
    highlightTint: [1.1, 1.0, 0.86],
    temperature: 0.22,
    tint: 0.01,
    lift: 0.018,
  },
  noite: {
    exposure: 1.04,
    contrast: 1.14,
    saturation: 1.08,
    shadowTint: [0.92, 0.96, 1.14],
    highlightTint: [1.06, 1.02, 0.94],
    temperature: 0.08,
    tint: 0,
    lift: 0.022,
  },
};

/** Ajuste por clima, somado em cima do horário. */
const BY_WEATHER: Record<GradeWeather, Partial<GradeRecipe>> = {
  limpo: {},
  nublado: { saturation: 0.94, contrast: 0.96, temperature: -0.04, lift: 0.014 },
  chuva: { saturation: 0.9, contrast: 1.04, temperature: -0.1, lift: 0.02, exposure: 1.02 },
  neve: { saturation: 0.86, contrast: 0.94, temperature: -0.06, lift: 0.028, exposure: 1.03 },
};

/** Ajuste por momento: gol/replay ganha contraste e calor de "lembrança". */
const BY_MOMENT: Record<GradeMoment, Partial<GradeRecipe>> = {
  match: {},
  replay: { contrast: 1.06, saturation: 1.04, temperature: 0.05 },
  drama: { contrast: 1.14, saturation: 1.1, exposure: 1.04, temperature: 0.1, lift: 0.01 },
};

export function gradeFor(
  time: GradeTime,
  weather: GradeWeather,
  moment: GradeMoment = "match",
): GradeRecipe {
  const base = BY_TIME[time] ?? BY_TIME.dia;
  const w = BY_WEATHER[weather] ?? {};
  const m = BY_MOMENT[moment] ?? {};
  return {
    exposure: base.exposure * (w.exposure ?? 1) * (m.exposure ?? 1),
    contrast: base.contrast * (w.contrast ?? 1) * (m.contrast ?? 1),
    saturation: base.saturation * (w.saturation ?? 1) * (m.saturation ?? 1),
    shadowTint: mixTint(base.shadowTint, w.shadowTint),
    highlightTint: mixTint(base.highlightTint, w.highlightTint),
    temperature: base.temperature + (w.temperature ?? 0) + (m.temperature ?? 0),
    tint: base.tint + (w.tint ?? 0) + (m.tint ?? 0),
    lift: base.lift + (w.lift ?? 0) + (m.lift ?? 0),
  };
}

function mixTint(
  a: [number, number, number],
  b?: [number, number, number],
): [number, number, number] {
  if (!b) return [...a] as [number, number, number];
  return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
}

export function gradeKey(time: GradeTime, weather: GradeWeather, moment: GradeMoment): string {
  return `${time}|${weather}|${moment}`;
}

/** Tamanho do cubo: 24³ já interpola sem banding perceptível e custa ~55 KB. */
export const LUT_SIZE = 24;

const cache = new Map<string, THREE.Data3DTexture>();
const MAX_CACHED = 12;

/**
 * Aplica a receita a um canal linear (0 a 1) já separado por cor.
 * Ordem: exposição → temperatura/matiz → curva de contraste → tingimento de
 * sombra/realce → elevação de sombra → saturação.
 */
export function applyRecipe(
  r: number,
  g: number,
  b: number,
  recipe: GradeRecipe,
): [number, number, number] {
  let r2 = r * recipe.exposure;
  let g2 = g * recipe.exposure;
  let b2 = b * recipe.exposure;

  // temperatura: aquece puxando azul para baixo e vermelho para cima
  const t = recipe.temperature;
  r2 *= 1 + t * 0.16;
  b2 *= 1 - t * 0.16;
  // matiz verde/magenta fica no canal do meio
  g2 *= 1 + recipe.tint * 0.1;

  // contraste em torno do cinza 0.5, com joelho suave para não estourar
  const c = recipe.contrast;
  const knee = (x: number) => {
    const d = x - 0.5;
    return 0.5 + d * c * (1 - Math.abs(d) * 0.35 * (c > 1 ? 1 : 0.6));
  };
  r2 = knee(r2);
  g2 = knee(g2);
  b2 = knee(b2);

  // tinta de sombra (quanto mais escuro, mais forte) e de realce (inverso)
  const lum = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
  const shadowWeight = Math.max(0, 1 - lum) ** 1.5;
  const highWeight = Math.max(0, lum) ** 2;
  r2 *= 1 + (recipe.shadowTint[0] - 1) * shadowWeight + (recipe.highlightTint[0] - 1) * highWeight;
  g2 *= 1 + (recipe.shadowTint[1] - 1) * shadowWeight + (recipe.highlightTint[1] - 1) * highWeight;
  b2 *= 1 + (recipe.shadowTint[2] - 1) * shadowWeight + (recipe.highlightTint[2] - 1) * highWeight;

  // elevação de sombra: levanta o preto sem tocar no branco
  r2 = r2 + recipe.lift * (1 - r2);
  g2 = g2 + recipe.lift * (1 - g2);
  b2 = b2 + recipe.lift * (1 - b2);

  // saturação em torno da luminância
  const l = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
  const s = recipe.saturation;
  r2 = l + (r2 - l) * s;
  g2 = l + (g2 - l) * s;
  b2 = l + (b2 - l) * s;

  return [r2, g2, b2];
}

/**
 * Constrói (e memoriza) a LUT 3D da combinação pedida.
 * A textura é `Data3DTexture` RGBA de 8 bits: compatível com WebGL2 e com o
 * caminho WebGPU, e pequena o suficiente para caber no cache de textura.
 */
export function gradeLut(
  time: GradeTime,
  weather: GradeWeather,
  moment: GradeMoment = "match",
): THREE.Data3DTexture {
  const key = gradeKey(time, weather, moment);
  const hit = cache.get(key);
  if (hit) return hit;

  const recipe = gradeFor(time, weather, moment);
  const size = LUT_SIZE;
  const data = new Uint8Array(size * size * size * 4);
  let i = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = x / (size - 1);
        const g = y / (size - 1);
        const b = z / (size - 1);
        const [r2, g2, b2] = applyRecipe(r, g, b, recipe);
        data[i++] = Math.round(Math.min(1, Math.max(0, r2)) * 255);
        data[i++] = Math.round(Math.min(1, Math.max(0, g2)) * 255);
        data[i++] = Math.round(Math.min(1, Math.max(0, b2)) * 255);
        data[i++] = 255;
      }
    }
  }

  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  cache.set(key, tex);
  if (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.get(oldest)?.dispose();
      cache.delete(oldest);
    }
  }
  return tex;
}

/** Memória ocupada pelas LUTs vivas (para o relatório de orçamento). */
export function gradeLutBytes(): number {
  return cache.size * LUT_SIZE * LUT_SIZE * LUT_SIZE * 4;
}

/** Esvazia o cache (troca de cenário, benchmark, teste). */
export function clearGradeLuts(): void {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}

/** Resumo textual da receita, para o painel de diagnóstico. */
export function describeGrade(recipe: GradeRecipe): string {
  const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;
  return `exposição ${pct(recipe.exposure - 1)} · contraste ${pct(recipe.contrast - 1)} · saturação ${pct(recipe.saturation - 1)}`;
}

export { NEUTRAL as NEUTRAL_TINT };
