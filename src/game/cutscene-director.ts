// ============================================================================
//  cutscene-director.ts
//  Direção cinematográfica das cutscenes: QUEM fala define ONDE a câmera fica.
//
//  Antes cada fala sorteava um travelling genérico da lista de SHOTS. Agora a
//  direção segue uma gramática simples, como numa transmissão de verdade:
//
//   - narrador      → plano geral, câmera lenta e distante (contexto);
//   - técnico/capitão → plano médio com push-in leve (autoridade);
//   - imprensa/torcida → contra-plano mais aberto (o "outro lado" da cena);
//   - momento de pico (gol, demissão, taça) → close com push-in forte.
//
//  É puro e determinístico: o mesmo roteiro gera sempre a mesma direção, e os
//  testes travam a gramática para ninguém quebrar o ritmo sem querer.
// ============================================================================

import type { Cutscene, CutsceneLine, SceneMood, Speaker } from "@/content/cutscenes";

/** Tamanho do plano: do contexto (geral) ao detalhe emocional (close). */
export type ShotSize = "geral" | "medio" | "proximo" | "close";

/** Luz da fala: o humor da cena pintado em cima do cenário. */
export type LineLight = "neutra" | "quente" | "fria" | "dramatica" | "festa";

export interface LineEmotion {
  /** tensão narrativa 0..1 (decisão, ultimato, pênalti) */
  tension: number;
  /** calor humano 0..1 (união, festa, reencontro) */
  warmth: number;
  /** urgência 0..1 (última chance, janela fechando, demissão) */
  urgency: number;
}

export interface LineDirection {
  index: number;
  who: Speaker;
  size: ShotSize;
  /** travelling da câmera dentro da fala: de → para (0..1) */
  dollyFrom: number;
  dollyTo: number;
  /** pausa extra depois da fala, em segundos */
  pause: number;
  light: LineLight;
  emotion: LineEmotion;
  /** true na fala de clímax da cena (efeito de câmera brilha nela) */
  beat: boolean;
}

export interface SceneDirection {
  id: string;
  lines: LineDirection[];
  /** índice da fala de clímax */
  climax: number;
  /** duração estimada da direção (soma das pausas extras) */
  extraPause: number;
}

/** Palavras que sobem a tensão, o calor ou a urgência de uma fala. */
const TENSION_WORDS = [
  "demit",
  "risco",
  "ultimato",
  "perigo",
  "queda",
  "rebaix",
  "decis",
  "pênalti",
  "penalti",
  "vermelho",
  "expuls",
  "crise",
  "pressão",
  "pressao",
  "ameaç",
  "ameac",
  "última chance",
  "ultima chance",
  "final",
  "apito",
];
const WARMTH_WORDS = [
  "campe",
  "festa",
  "gol",
  "goool",
  "vitória",
  "vitoria",
  "título",
  "titulo",
  "taça",
  "taca",
  "acesso",
  "subimos",
  "junto",
  "grupo",
  "família",
  "familia",
  "obrigado",
  "eterno",
  "lenda",
  "abraço",
  "abraco",
  "sonho",
];
const URGENCY_WORDS = [
  "agora",
  "hoje",
  "amanhã",
  "amanha",
  "já",
  "corre",
  "rápido",
  "rapido",
  "fecha",
  "últim",
  "ultim",
  "janela",
  "prazo",
  "horas",
  "minutos",
  "não dá",
  "nao da",
  "precisa",
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function countHits(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const word of words) {
    if (lower.includes(word)) hits++;
  }
  return hits;
}

/**
 * Emoção de uma fala: palavras-chave + humor da cena + posição no roteiro.
 * O final da cena pesa mais (clímax tende a ficar nas últimas falas).
 */
export function emotionFor(line: CutsceneLine, mood: SceneMood, position: number): LineEmotion {
  const end = clamp01(position); // 0 = começo, 1 = fim
  const tension = clamp01(
    countHits(line.text, TENSION_WORDS) * 0.34 + (mood === "bad" ? 0.28 : 0) + end * 0.18,
  );
  const warmth = clamp01(
    countHits(line.text, WARMTH_WORDS) * 0.34 + (mood === "good" ? 0.3 : 0) + end * 0.12,
  );
  const urgency = clamp01(countHits(line.text, URGENCY_WORDS) * 0.3 + end * 0.1);
  return { tension, warmth, urgency };
}

/** Tamanho de plano base de cada personagem. */
const SIZE_BY_SPEAKER: Record<Speaker, ShotSize> = {
  narrator: "geral",
  commentator: "medio",
  referee: "medio",
  manager: "medio",
  captain: "proximo",
  president: "medio",
  press: "medio",
  assistant: "medio",
  doctor: "medio",
  scout: "medio",
  agent: "proximo",
  fan: "geral",
};

/**
 * Tamanho final do plano: tensão alta aproxima (close), calor alto abre e
 * depois aproxima de leve. O narrador nunca sai do geral — é a voz de fora.
 */
export function sizeFor(who: Speaker, emotion: LineEmotion, isClimax: boolean): ShotSize {
  if (who === "narrator") return "geral";
  if (isClimax) return "close";
  if (emotion.tension >= 0.6 || emotion.urgency >= 0.7) return "proximo";
  if (emotion.warmth >= 0.7 && emotion.tension < 0.3)
    return SIZE_BY_SPEAKER[who] === "geral" ? "geral" : "medio";
  return SIZE_BY_SPEAKER[who];
}

/** Luz da fala a partir da emoção dominante. */
export function lightFor(emotion: LineEmotion, mood: SceneMood): LineLight {
  if (emotion.warmth >= 0.7 && mood === "good") return "festa";
  if (emotion.tension >= 0.65 || (mood === "bad" && emotion.tension >= 0.4)) return "dramatica";
  if (emotion.warmth >= 0.5) return "quente";
  if (mood === "bad") return "fria";
  return "neutra";
}

/** Travelling dentro da fala: tensão empurra para dentro, calma recua um pouco. */
export function dollyFor(emotion: LineEmotion, size: ShotSize): { from: number; to: number } {
  const push = clamp01(emotion.tension * 0.7 + emotion.urgency * 0.5 - emotion.warmth * 0.25);
  if (size === "geral") return { from: 0.15, to: 0.15 + push * 0.25 };
  if (size === "close") return { from: 0.55, to: 1 };
  if (size === "proximo") return { from: 0.3, to: 0.3 + 0.3 + push * 0.3 };
  return { from: 0.2, to: 0.2 + 0.25 + push * 0.3 };
}

/** Pausa dramática depois da fala: clímax e tensão pedem silêncio. */
export function pauseFor(emotion: LineEmotion, isClimax: boolean, isLast: boolean): number {
  if (isLast) return 0.9;
  if (isClimax) return 1.4;
  if (emotion.tension >= 0.6) return 0.7;
  if (emotion.urgency >= 0.6) return 0.25;
  return 0.45;
}

/** Pontuação de "clímax": a fala mais carregada da cena. */
function climaxScore(emotion: LineEmotion, position: number): number {
  return emotion.tension * 1.4 + emotion.urgency * 0.9 + emotion.warmth * 0.8 + position * 0.5;
}

/**
 * Dirige a cena inteira. O clímax é a fala de maior pontuação — empates ficam
 * com a última, porque revelação gosta de fim de cena.
 */
export function directScene(scene: Cutscene): SceneDirection {
  const mood: SceneMood = scene.mood ?? "neutral";
  const total = Math.max(1, scene.lines.length);
  const emotions = scene.lines.map((line, index) =>
    emotionFor(line, mood, total === 1 ? 1 : index / (total - 1)),
  );

  let climax = 0;
  let best = -Infinity;
  emotions.forEach((emotion, index) => {
    const score = climaxScore(emotion, total === 1 ? 1 : index / (total - 1));
    if (score >= best) {
      best = score;
      climax = index;
    }
  });

  const lines = scene.lines.map((line, index) => {
    const emotion = emotions[index]!;
    const isClimax = index === climax;
    const size = sizeFor(line.who, emotion, isClimax);
    const dolly = dollyFor(emotion, size);
    return {
      index,
      who: line.who,
      size,
      dollyFrom: round2(dolly.from),
      dollyTo: round2(dolly.to),
      pause: pauseFor(emotion, isClimax, index === scene.lines.length - 1),
      light: lightFor(emotion, mood),
      emotion,
      beat: isClimax,
    } satisfies LineDirection;
  });

  return {
    id: scene.id,
    lines,
    climax,
    extraPause: round2(lines.reduce((sum, line) => sum + line.pause, 0)),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Escolhe QUAL travelling da lista existente usar para esta fala. A lista de
 * SHOTS da timeline continua a mesma (nada quebra); a direção só prefere os
 * que combinam com o movimento: `close` quer zoom entrando, `geral` quer zoom
 * saindo ou parado. Determinístico por (cena, fala).
 */
export function shotIndexFor(
  direction: LineDirection,
  sceneId: string,
  shots: readonly { dz: number }[],
): number {
  if (shots.length === 0) return 0;
  const wantsPushIn = direction.dollyTo - direction.dollyFrom > 0.2;
  const candidates = shots
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => (wantsPushIn ? shot.dz >= 0 : shot.dz <= 0.04));
  const pool = candidates.length > 0 ? candidates : shots.map((_, index) => ({ index }));
  // offset fixo por cena + giro por fala: falas seguidas nunca repetem o plano,
  // cenas diferentes começam em pontos diferentes, tudo determinístico.
  const offset = Math.floor(fnv(sceneId) * pool.length);
  return pool[(direction.index + offset) % pool.length]!.index;
}

function fnv(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Resumo de uma linha para depuração/HUD. */
export function describeLine(direction: LineDirection): string {
  return `#${direction.index + 1} ${direction.who} · ${direction.size} · ${direction.light} · pausa ${direction.pause}s${direction.beat ? " · CLÍMAX" : ""}`;
}
