/**
 * Catálogo único da linguagem de transmissão da partida.
 *
 * Os IDs de câmera são um contrato persistido: carreira, partida rápida,
 * multiplayer e replays podem gravá-los sem depender dos textos ou da ordem
 * visual do cockpit. As especificações de plano dão ao Diretor uma camada
 * editorial estável sem acoplar a interface ao renderizador R3F.
 */

export const CAMERA_CATEGORIES = [
  {
    id: "transmissao",
    label: "Transmissão",
    description: "Planos pensados para acompanhar o jogo com clareza.",
  },
  {
    id: "cinema",
    label: "Cinema",
    description: "Enquadramentos de impacto para momentos editoriais.",
  },
  {
    id: "tatica",
    label: "Tática",
    description: "Leitura de espaços, linhas e trajetórias da bola.",
  },
  {
    id: "imersao",
    label: "Imersão",
    description: "Pontos de vista próximos do campo e da arquibancada.",
  },
] as const;

export type CameraCategory = (typeof CAMERA_CATEGORIES)[number]["id"];

/**
 * Não trocar ou remover IDs sem uma migração de replays e preferências.
 * Os metadados permitem que qualquer HUD agrupe câmeras sem duplicar regras.
 */
export interface CameraOption {
  id:
    | "broadcast"
    | "director"
    | "cinematic"
    | "skycam"
    | "tactical"
    | "sideline"
    | "rail"
    | "player"
    | "behind"
    | "goal"
    | "fan";
  label: string;
  shortLabel: string;
  description: string;
  category: CameraCategory;
  /** O Diretor pode usar esta lente como parte de uma sequência editorial. */
  directorEligible: boolean;
  /** Informa à UI se a lente abre pós-processamento editorial. */
  cinematicTreatment: boolean;
}

export const CAMERA_OPTIONS = [
  {
    id: "broadcast",
    label: "TV",
    shortLabel: "TV",
    description: "Transmissão automática, aberta e orientada pelo lance.",
    category: "transmissao",
    directorEligible: true,
    cinematicTreatment: false,
  },
  {
    id: "director",
    label: "Diretor",
    shortLabel: "Dir.",
    description: "Cortes cinematográficos com retenção segura entre planos.",
    category: "transmissao",
    directorEligible: true,
    cinematicTreatment: true,
  },
  {
    id: "cinematic",
    label: "Cinema",
    shortLabel: "Cinema",
    description: "Plano de grua artístico com pós-processamento cinematográfico.",
    category: "cinema",
    directorEligible: true,
    cinematicTreatment: true,
  },
  {
    id: "rail",
    label: "Trilho",
    shortLabel: "Trilho",
    description: "Travelling rente à lateral para acompanhar a jogada.",
    category: "cinema",
    directorEligible: true,
    cinematicTreatment: true,
  },
  {
    id: "player",
    label: "Jogador",
    shortLabel: "Jogador",
    description: "Enquadramento fechado dos duelos e do portador da bola.",
    category: "cinema",
    directorEligible: true,
    cinematicTreatment: true,
  },
  {
    id: "goal",
    label: "Gol",
    shortLabel: "Gol",
    description: "Câmera atrás da rede para finalizações e defesas.",
    category: "cinema",
    directorEligible: true,
    cinematicTreatment: true,
  },
  {
    id: "tactical",
    label: "Tática",
    shortLabel: "Tática",
    description: "Leitura ampla das linhas, espaços e formações.",
    category: "tatica",
    directorEligible: false,
    cinematicTreatment: false,
  },
  {
    id: "skycam",
    label: "Skycam",
    shortLabel: "Sky",
    description: "Vista aérea móvel que antecipa a trajetória da bola.",
    category: "tatica",
    directorEligible: true,
    cinematicTreatment: false,
  },
  {
    id: "sideline",
    label: "Lateral",
    shortLabel: "Lateral",
    description: "Câmera baixa da área técnica, junto ao campo.",
    category: "imersao",
    directorEligible: true,
    cinematicTreatment: true,
  },
  {
    id: "behind",
    label: "Atrás",
    shortLabel: "Atrás",
    description: "Segue por trás o jogador que conduz a posse.",
    category: "imersao",
    directorEligible: true,
    cinematicTreatment: false,
  },
  {
    id: "fan",
    label: "Torcida",
    shortLabel: "Torcida",
    description: "Arquibancada viva, com visão de torcedor.",
    category: "imersao",
    directorEligible: true,
    cinematicTreatment: true,
  },
] as const satisfies readonly CameraOption[];

export type CameraMode = (typeof CAMERA_OPTIONS)[number]["id"];

export type ShotSubject = "estadio" | "jogada" | "duelo" | "finalizacao" | "gol" | "torcida";
export type ShotIntent =
  "abertura" | "transicao" | "tensao" | "finalizacao" | "celebracao" | "retorno";
export type ShotLens = "aberta" | "normal" | "tele" | "aerea";
export type ShotSafeZone = "campo" | "terco-final" | "area" | "gol" | "estadio";
export type ShotPostProcess = "nenhum" | "broadcast" | "cinematico";

/**
 * Contrato editorial consumível pelo cockpit, replay e futuro seletor do
 * Diretor. O renderizador continua responsável pela posição física da câmera.
 */
export interface ShotSpec {
  id: string;
  label: string;
  subject: ShotSubject;
  intent: ShotIntent;
  lens: ShotLens;
  minimumHoldMs: number;
  safeZone: ShotSafeZone;
  postProcess: ShotPostProcess;
  fallbackCamera: CameraMode;
  compatibleModes: readonly CameraMode[];
}

export const SHOT_SPECS = [
  {
    id: "opening-crane",
    label: "Abertura de grua",
    subject: "estadio",
    intent: "abertura",
    lens: "aberta",
    minimumHoldMs: 4400,
    safeZone: "estadio",
    postProcess: "cinematico",
    fallbackCamera: "cinematic",
    compatibleModes: ["director", "cinematic"],
  },
  {
    id: "transition-rail",
    label: "Travelling de transição",
    subject: "jogada",
    intent: "transicao",
    lens: "normal",
    minimumHoldMs: 3000,
    safeZone: "campo",
    postProcess: "broadcast",
    fallbackCamera: "rail",
    compatibleModes: ["director", "rail", "sideline"],
  },
  {
    id: "duel-player",
    label: "Plano de duelo",
    subject: "duelo",
    intent: "tensao",
    lens: "tele",
    minimumHoldMs: 2200,
    safeZone: "campo",
    postProcess: "cinematico",
    fallbackCamera: "player",
    compatibleModes: ["director", "player", "behind"],
  },
  {
    id: "finish-goalline",
    label: "Linha do gol",
    subject: "finalizacao",
    intent: "finalizacao",
    lens: "tele",
    minimumHoldMs: 2600,
    safeZone: "area",
    postProcess: "cinematico",
    fallbackCamera: "goal",
    compatibleModes: ["director", "goal", "sideline"],
  },
  {
    id: "goal-net",
    label: "Atrás da rede",
    subject: "gol",
    intent: "finalizacao",
    lens: "normal",
    minimumHoldMs: 2600,
    safeZone: "gol",
    postProcess: "cinematico",
    fallbackCamera: "goal",
    compatibleModes: ["director", "goal"],
  },
  {
    id: "celebration-fan",
    label: "Celebração e torcida",
    subject: "torcida",
    intent: "celebracao",
    lens: "normal",
    minimumHoldMs: 2400,
    safeZone: "estadio",
    postProcess: "cinematico",
    fallbackCamera: "fan",
    compatibleModes: ["director", "fan", "cinematic"],
  },
  {
    id: "return-tv",
    label: "Retorno à transmissão",
    subject: "jogada",
    intent: "retorno",
    lens: "aberta",
    minimumHoldMs: 4500,
    safeZone: "campo",
    postProcess: "broadcast",
    fallbackCamera: "broadcast",
    compatibleModes: ["director", "broadcast", "tactical"],
  },
] as const satisfies readonly ShotSpec[];

export type ShotId = (typeof SHOT_SPECS)[number]["id"];

/**
 * Ordem histórica do atalho C. O catálogo visual pode ser reorganizado por
 * categorias, mas replays e memória muscular do jogador mantêm este ciclo.
 */
export const CAMERA_CYCLE = [
  "broadcast",
  "director",
  "cinematic",
  "skycam",
  "tactical",
  "sideline",
  "rail",
  "player",
  "behind",
  "goal",
  "fan",
] as const satisfies readonly CameraMode[];

/** Devolve a opção visível para o modo atual, sem duplicar rótulos nos HUDs. */
export function cameraOption(mode: CameraMode): CameraOption {
  return CAMERA_OPTIONS.find((option) => option.id === mode) ?? CAMERA_OPTIONS[0]!;
}

/** Agrupa câmeras para os painéis de transmissão sem reproduzir a taxonomia. */
export function camerasForCategory(category: CameraCategory): readonly CameraOption[] {
  return CAMERA_OPTIONS.filter((option) => option.category === category);
}

/** Valida valores persistidos, URLs ou mensagens antigas sem quebrar replays. */
export function isCameraMode(value: unknown): value is CameraMode {
  return typeof value === "string" && CAMERA_OPTIONS.some((option) => option.id === value);
}

/** Busca o plano editorial por ID com retorno seguro para a transmissão aberta. */
export function shotSpec(id: ShotId): ShotSpec {
  return SHOT_SPECS.find((spec) => spec.id === id) ?? SHOT_SPECS[SHOT_SPECS.length - 1]!;
}

/** Próxima câmera na ordem de uso mais natural para botões compactos e tecla C. */
export function nextCameraMode(mode: CameraMode): CameraMode {
  const index = CAMERA_CYCLE.indexOf(mode);
  return CAMERA_CYCLE[(index + 1 + CAMERA_CYCLE.length) % CAMERA_CYCLE.length]!;
}
