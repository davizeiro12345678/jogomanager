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
import { isCameraMode, type CameraMode } from "@/game/camera-modes";
import type { TimeOfDay, Weather } from "@/game/matchday";

export type Auto<T extends string> = "auto" | T;

export type QualityPref = "auto" | "baixa" | "media" | "alta" | "cinema";
export type ShadowPref = "auto" | "ligadas" | "desligadas";
export type TextureDetail = "baixa" | "media" | "alta";
export type PlayerDetail = "simples" | "padrao" | "detalhado";

/** Preferências que acompanham a transmissão sem afetar a simulação. */
export interface BroadcastPreferences {
  /** Última lente escolhida fora da galeria de replay. */
  camera: CameraMode;
  /** Quando ligado, o Diretor pode escolher planos editoriais durante o lance. */
  directorAuto: boolean;
  /** Atalhos do cockpit; o limite mantém a UI móvel legível. */
  favorites: CameraMode[];
  /** "inherit" reaproveita a lente da partida no player de replays. */
  replayCamera: CameraMode | "inherit";
}

export const DEFAULT_BROADCAST: BroadcastPreferences = {
  camera: "broadcast",
  directorAuto: false,
  favorites: ["broadcast", "director", "tactical", "goal"],
  replayCamera: "inherit",
};

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
  version: 3;

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

  /* transmissão */
  broadcast: BroadcastPreferences;

  /* por clube + extras */
  byClub: Record<string, ClubVisual>;
  sponsors: string[];
}

export const DEFAULT_VISUAL: VisualSettings = {
  version: 3,
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
  broadcast: { ...DEFAULT_BROADCAST },
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
  transmissao: ["broadcast"],
  clubes: ["byClub"],
  placas: ["sponsors"],
} satisfies Record<string, readonly (keyof VisualSettings)[]>;

export type VisualSection = keyof typeof VISUAL_SECTIONS;

const KEY = "manager3d.visual.v3";
const LEGACY_KEYS = ["manager3d.visual.v2", "manager3d.visual.v1"] as const;

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

/** Normaliza dados locais sem permitir ID inválido de quebrar um replay antigo. */
export function normalizeBroadcastPreferences(value: unknown): BroadcastPreferences {
  const raw = isRecord(value) ? value : {};
  const selectedCamera = isCameraMode(raw["camera"]) ? raw["camera"] : DEFAULT_BROADCAST.camera;
  const favorites = Array.isArray(raw["favorites"])
    ? raw["favorites"].filter(isCameraMode)
    : [...DEFAULT_BROADCAST.favorites];
  const replayCamera =
    raw["replayCamera"] === "inherit" || isCameraMode(raw["replayCamera"])
      ? raw["replayCamera"]
      : DEFAULT_BROADCAST.replayCamera;
  // O modo Diretor é representado pelo mesmo ID usado pelo renderizador.
  const directorAuto =
    raw["directorAuto"] === true ||
    (raw["directorAuto"] !== false && selectedCamera === "director");

  return {
    camera: directorAuto ? "director" : selectedCamera,
    // Reproduz a escolha de Diretor feita nas versões que só guardavam a lente.
    directorAuto,
    favorites: Array.from(new Set(favorites)).slice(0, 4),
    replayCamera,
  };
}

/** Migra v1/v2 sem perder escolhas de cenário e acrescenta transmissão segura. */
export function migrateVisualSettings(raw: unknown): Partial<VisualSettings> {
  if (!isRecord(raw)) return {};
  const o = raw;
  const legacyBroadcast = isRecord(o["broadcast"])
    ? o["broadcast"]
    : {
        camera: o["camera"],
        directorAuto: o["directorAuto"],
        favorites: o["cameraFavorites"],
        replayCamera: o["replayCamera"],
      };
  const broadcast = normalizeBroadcastPreferences(legacyBroadcast);

  if (o["version"] === 3 || o["version"] === 2) {
    return { ...o, broadcast } as Partial<VisualSettings>;
  }

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
    broadcast,
  };
}

function sanitize(v: VisualSettings): VisualSettings {
  return {
    ...v,
    version: 3,
    grassDensity: clamp(v.grassDensity, 0, 1.5, 1),
    crowdDensity: clamp(v.crowdDensity, 0.2, 1.5, 1),
    postIntensity: clamp(v.postIntensity, 0.2, 1.4, 1),
    particles: clamp(v.particles, 0, 1.5, 1),
    resolutionScale: clamp(v.resolutionScale, 0.6, 1.2, 1),
    showFps: v.showFps === true,
    grassTint: clamp(v.grassTint, -1, 1, 0),
    grassWear: clamp(v.grassWear, 0, 1, 0.5),
    wind: v.wind === "auto" ? "auto" : clamp(v.wind, 0, 1, 0.5),
    broadcast: normalizeBroadcastPreferences(v.broadcast),
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
    const raw =
      localStorage.getItem(KEY) ??
      LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) ??
      null;
    cache = raw
      ? sanitize({ ...DEFAULT_VISUAL, ...migrateVisualSettings(JSON.parse(raw) as unknown) })
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

/** Atualiza somente o cockpit sem clobber dos outros ajustes de aparência. */
export function setBroadcastPreferences(patch: Partial<BroadcastPreferences>) {
  return setVisual({
    broadcast: normalizeBroadcastPreferences({ ...getVisual().broadcast, ...patch }),
  });
}

/** Lê somente a parte de transmissão sem expor a forma do armazenamento local. */
export function getBroadcastPreferences(): BroadcastPreferences {
  return getVisual().broadcast;
}

/** Atalho idempotente para os quatro favoritos da transmissão. */
export function toggleBroadcastFavorite(camera: CameraMode) {
  const current = getVisual().broadcast.favorites;
  const favorites = current.includes(camera)
    ? current.filter((entry) => entry !== camera)
    : [...current, camera].slice(0, 4);
  return setBroadcastPreferences({ favorites });
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

/** Preferências reativas usadas por controles compartilhados de partida e replay. */
export function useBroadcastPreferences(): BroadcastPreferences {
  return useVisual().broadcast;
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
