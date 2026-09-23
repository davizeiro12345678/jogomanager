/**
 * Ajustes visuais escolhidos pelo usuário na página /visual.
 *
 * Fonte única de verdade: tudo o que muda a aparência do jogo (texturas,
 * geometria, sombras, efeitos, clima, horário, vento e gramado) fica aqui,
 * salvo no navegador, e é lido pelo estádio 3D e pela "cara" da partida.
 *
 * Precedência (do mais fraco para o mais forte):
 *   aparência original → ajustes globais → ajustes do clube mandante →
 *   prévia temporária → limites de desempenho (aplicados no render).
 *
 * Nada aqui altera o resultado da simulação: é só aparência.
 */
import { useEffect, useState } from "react";

import type { MowPattern } from "@/components/game/stadium/textures/grass";
import type { TimeOfDay, Weather } from "@/game/matchday";

export type Auto<T extends string> = "auto" | T;

export type QualityPref = "auto" | "baixa" | "media" | "alta" | "cinema";
export type ShadowPref = "auto" | "ligadas" | "desligadas";
export type TextureDetail = "baixa" | "media" | "alta";
export type PlayerDetail = "simples" | "padrao" | "detalhado";

/** Ajustes que um clube pode sobrescrever nos jogos em casa. */
export interface ClubVisual {
  mow?: MowPattern;
  weather?: Weather;
  time?: TimeOfDay;
  /** -1 (gramado mais claro) a 1 (mais escuro) */
  grassTint?: number;
  /** 0 (gramado impecável) a 1 (bem castigado) */
  grassWear?: number;
}

export interface VisualSettings {
  version: 2;

  /* qualidade */
  /** nível pedido pelo jogador ("auto" = detectado pelo aparelho) */
  quality: QualityPref;
  /** deixa o jogo baixar/subir a qualidade sozinho durante a partida */
  adaptive: boolean;
  textureDetail: TextureDetail;
  playerDetail: PlayerDetail;
  grassDensity: number;
  crowdDensity: number;
  shadows: ShadowPref;
  postFx: boolean;
  /** intensidade dos efeitos de imagem (0.2 a 1.4) */
  postIntensity: number;
  /** partículas (chuva, neve, confete, fumaça) — 0 desliga */
  particles: number;
  /** escala de resolução do 3D (0.6 a 1.2) */
  resolutionScale: number;
  /** mostra o medidor de quadros por segundo durante a partida */
  showFps: boolean;

  /* mundo */
  weather: Auto<Weather>;
  time: Auto<TimeOfDay>;
  mow: Auto<MowPattern>;
  /** vento: "auto" segue o sorteio da partida; número fixa de 0 a 1 */
  wind: number | "auto";
  grassTint: number;
  grassWear: number;

  /* por clube + extras */
  byClub: Record<string, ClubVisual>;
  sponsors: string[];
}

export const DEFAULT_VISUAL: VisualSettings = {
  version: 2,
  quality: "auto",
  adaptive: true,
  textureDetail: "alta",
  playerDetail: "padrao",
  grassDensity: 1,
  crowdDensity: 1,
  shadows: "auto",
  postFx: true,
  postIntensity: 1,
  particles: 1,
  resolutionScale: 1,
  showFps: false,
  weather: "auto",
  time: "auto",
  mow: "auto",
  wind: "auto",
  grassTint: 0,
  grassWear: 0.5,
  byClub: {},
  sponsors: [],
};

/** Seções usadas pelos botões "restaurar" da página /visual. */
export const VISUAL_SECTIONS = {
  qualidade: [
    "quality",
    "adaptive",
    "textureDetail",
    "playerDetail",
    "grassDensity",
    "crowdDensity",
    "shadows",
    "postFx",
    "postIntensity",
    "particles",
    "resolutionScale",
    "showFps",
  ],
  mundo: ["weather", "time", "mow", "wind", "grassTint", "grassWear"],
  clubes: ["byClub"],
  placas: ["sponsors"],
} satisfies Record<string, readonly (keyof VisualSettings)[]>;

export type VisualSection = keyof typeof VISUAL_SECTIONS;

const KEY = "manager3d.visual.v2";
const LEGACY_KEY = "manager3d.visual.v1";

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
}

/** Migração da versão 1 (chaves antigas) sem perder nenhuma escolha. */
function migrate(raw: unknown): Partial<VisualSettings> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  if (o["version"] === 2) return o as Partial<VisualSettings>;

  const byClub: Record<string, ClubVisual> = {};
  const legacyMow = o["mowByClub"];
  if (legacyMow && typeof legacyMow === "object") {
    for (const [id, mow] of Object.entries(legacyMow as Record<string, MowPattern>)) {
      if (mow) byClub[id] = { mow };
    }
  }
  return {
    textureDetail: o["textureDetail"] as TextureDetail,
    playerDetail: o["playerDetail"] as PlayerDetail,
    grassDensity: clamp(o["grassDensity"], 0, 1.5, 1),
    crowdDensity: clamp(o["crowdDensity"], 0.2, 1.5, 1),
    weather: (o["weather"] as Auto<Weather>) ?? "auto",
    time: (o["time"] as Auto<TimeOfDay>) ?? "auto",
    mow: (o["mow"] as Auto<MowPattern>) ?? "auto",
    postFx: o["postFx"] !== false,
    sponsors: Array.isArray(o["sponsors"]) ? (o["sponsors"] as string[]) : [],
    byClub,
  };
}

function sanitize(v: VisualSettings): VisualSettings {
  return {
    ...v,
    version: 2,
    grassDensity: clamp(v.grassDensity, 0, 1.5, 1),
    crowdDensity: clamp(v.crowdDensity, 0.2, 1.5, 1),
    postIntensity: clamp(v.postIntensity, 0.2, 1.4, 1),
    particles: clamp(v.particles, 0, 1.5, 1),
    resolutionScale: clamp(v.resolutionScale, 0.6, 1.2, 1),
    showFps: v.showFps === true,
    grassTint: clamp(v.grassTint, -1, 1, 0),
    grassWear: clamp(v.grassWear, 0, 1, 0.5),
    wind: v.wind === "auto" ? "auto" : clamp(v.wind, 0, 1, 0.5),
    byClub: v.byClub ?? {},
    sponsors: Array.isArray(v.sponsors) ? v.sponsors.slice(0, 8) : [],
  };
}

let cache: VisualSettings | null = null;
const listeners = new Set<(v: VisualSettings) => void>();

export function getVisual(): VisualSettings {
  if (cache) return cache;
  if (typeof localStorage === "undefined") return DEFAULT_VISUAL;
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    cache = raw
      ? sanitize({ ...DEFAULT_VISUAL, ...migrate(JSON.parse(raw) as unknown) })
      : DEFAULT_VISUAL;
    // grava já na chave nova, mantendo a antiga intacta como cópia de segurança
    if (raw && !localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify(cache));
    }
  } catch {
    cache = DEFAULT_VISUAL;
  }
  return cache;
}

export function setVisual(patch: Partial<VisualSettings>) {
  const next = sanitize({ ...getVisual(), ...patch });
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

/** Restaura apenas uma seção da página de ajustes. */
export function resetSection(section: VisualSection) {
  const patch: Partial<VisualSettings> = {};
  for (const k of VISUAL_SECTIONS[section]) {
    (patch as Record<string, unknown>)[k] = DEFAULT_VISUAL[k];
  }
  return setVisual(patch);
}

/** Ajustes de um clube específico (jogos em casa). */
export function setClubVisual(clubId: string, patch: ClubVisual | null) {
  const byClub = { ...getVisual().byClub };
  if (!patch || Object.keys(patch).length === 0) delete byClub[clubId];
  else byClub[clubId] = { ...byClub[clubId], ...patch };
  return setVisual({ byClub });
}

/** Assina mudanças (usado pelo React e pelo estádio). */
export function subscribeVisual(fn: (v: VisualSettings) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------------------------------------------------------ prévia */

/**
 * Prévia temporária: usada pela página /visual para mostrar o resultado sem
 * gravar nada. Nunca é persistida e some ao sair da página.
 */
let preview: Partial<VisualSettings> | null = null;
const previewListeners = new Set<(p: Partial<VisualSettings> | null) => void>();

export function setVisualPreview(p: Partial<VisualSettings> | null) {
  preview = p;
  for (const l of previewListeners) l(p);
}
export function getVisualPreview() {
  return preview;
}
export function subscribeVisualPreview(fn: (p: Partial<VisualSettings> | null) => void) {
  previewListeners.add(fn);
  return () => previewListeners.delete(fn);
}

/* ------------------------------------------------------------ hooks */

/** Hook: devolve os ajustes atuais (com prévia) e re-renderiza quando mudam. */
export function useVisual(): VisualSettings {
  const [v, setV] = useState<VisualSettings>(() => ({
    ...getVisual(),
    ...(getVisualPreview() ?? {}),
  }));
  useEffect(() => {
    const sync = () => setV({ ...getVisual(), ...(getVisualPreview() ?? {}) });
    const offA = subscribeVisual(sync);
    const offB = subscribeVisualPreview(sync);
    sync();
    return () => {
      offA();
      offB();
    };
  }, []);
  return v;
}

/**
 * Ajustes efetivos para um clube mandante, já com a precedência aplicada.
 * Clube sem personalização conserva exatamente a aparência global.
 */
export function resolveVisual(clubId?: string): VisualSettings {
  const base = { ...getVisual(), ...(getVisualPreview() ?? {}) };
  const club = clubId ? base.byClub[clubId] : undefined;
  if (!club) return base;
  return {
    ...base,
    mow: club.mow ?? base.mow,
    weather: club.weather ?? base.weather,
    time: club.time ?? base.time,
    grassTint: club.grassTint ?? base.grassTint,
    grassWear: club.grassWear ?? base.grassWear,
  };
}

/** Versão reativa de `resolveVisual`. */
export function useResolvedVisual(clubId?: string): VisualSettings {
  const v = useVisual();
  const club = clubId ? v.byClub[clubId] : undefined;
  if (!club) return v;
  return {
    ...v,
    mow: club.mow ?? v.mow,
    weather: club.weather ?? v.weather,
    time: club.time ?? v.time,
    grassTint: club.grassTint ?? v.grassTint,
    grassWear: club.grassWear ?? v.grassWear,
  };
}

/** Multiplicador de densidade aplicado às malhas instanciadas. */
export function densityScale(v: VisualSettings) {
  return {
    grass: Math.max(0, v.grassDensity),
    crowd: Math.max(0.1, v.crowdDensity),
    texture: v.textureDetail === "alta" ? 1 : v.textureDetail === "media" ? 0.6 : 0.3,
  };
}
