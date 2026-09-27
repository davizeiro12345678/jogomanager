// ============================================================================
//  cutscene-timeline.ts
//  Motor de timeline das cutscenes.
//
//  O motor antigo era orientado a clique: cada fala esperava o toque, a máquina
//  de escrever rodava num `setInterval` solto e o travelling da câmera num
//  `requestAnimationFrame` independente. Nada disso se compunha — não dava para
//  ensaiar uma cena, sincronizar com a voz, nem reutilizar o mesmo tempo em
//  outro lugar (o momento cinematográfico dentro da partida, por exemplo).
//
//  Aqui a cena é uma linha do tempo: cada fala tem instante de início, duração
//  de leitura, duração da voz (quando conhecida), enquadramento e efeito. Tudo
//  derivado de forma determinística a partir do roteiro, então a mesma cena
//  produz sempre o mesmo filme — e o teste pode afirmar isso.
//
//  Função pura: nenhum DOM, nenhum timer, nenhum efeito colateral.
// ============================================================================

import type { Cutscene, CutsceneLine, SceneMood, Speaker } from "@/content/cutscenes";
import { directScene, shotIndexFor } from "@/game/cutscene-director";

/** Ritmo de leitura da narração, em caracteres por segundo. */
const CHARS_PER_SECOND = 15;
/** Piso e teto de duração de uma fala, em segundos. */
const MIN_LINE = 1.7;
const MAX_LINE = 7.5;
/** Pausa entre falas, por locutor. */
const PAUSE: Record<Speaker, number> = {
  manager: 0.4,
  president: 0.55,
  press: 0.35,
  captain: 0.45,
  narrator: 0.8,
  commentator: 0.3,
  referee: 0.5,
  assistant: 0.4,
  doctor: 0.45,
  scout: 0.4,
  agent: 0.4,
  fan: 0.35,
};
/** Locutores mais rápidos/lentos modificam o ritmo da fala. */
const PACE: Record<Speaker, number> = {
  manager: 1,
  president: 0.92,
  press: 1.12,
  captain: 1,
  narrator: 0.88,
  commentator: 1.2,
  referee: 0.85,
  assistant: 1.05,
  doctor: 0.95,
  scout: 1,
  agent: 1.05,
  fan: 1.1,
};

/** Enquadramento: posição inicial + direção do travelling dentro da fala. */
export interface Shot {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
}

export const SHOTS: readonly Shot[] = [
  { x: 0, y: 0, z: 0, dx: 10, dy: -3, dz: 0.05 },
  { x: -10, y: -4, z: 0.06, dx: 12, dy: 4, dz: 0.04 },
  { x: 9, y: 3, z: 0.03, dx: -14, dy: -5, dz: 0.06 },
  { x: -4, y: 6, z: 0.09, dx: 6, dy: -8, dz: 0.03 },
];

/** Uma fala na linha do tempo. */
export interface TimelineLine {
  index: number;
  who: Speaker;
  text: string;
  /** instante de início, em segundos desde o começo da cena */
  at: number;
  /** duração total da fala (leitura + voz + pausa) */
  duration: number;
  /** fração da duração ocupada pela digitação (0..1) */
  typedUntil: number;
  shot: Shot;
  /** true quando a duração veio da voz real, não da estimativa */
  voiced: boolean;
}

export interface CutsceneTimeline {
  id: string;
  lines: TimelineLine[];
  /** duração total da cena, em segundos */
  duration: number;
}

/** Estado da cena num instante qualquer. */
export interface TimelineSample {
  lineIndex: number;
  line: TimelineLine;
  /** progresso dentro da fala (0..1) */
  local: number;
  /** caracteres já digitados */
  typed: number;
  /** travelling da câmera dentro da fala (0..1, com suavização) */
  dolly: number;
  finished: boolean;
}

/** Suavização quadrática (smoothstep): velocidade zero nas pontas. */
export function smoothstep(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}

/** Duração estimada de uma fala, em segundos. */
export function estimateLineDuration(line: CutsceneLine): number {
  const chars = line.text.trim().length;
  const reading = chars / (CHARS_PER_SECOND * PACE[line.who]);
  return Math.min(MAX_LINE, Math.max(MIN_LINE, reading)) + PAUSE[line.who];
}

/**
 * Monta a linha do tempo de uma cena.
 *
 * @param scene     roteiro
 * @param durations duração real de cada fala (voz), quando disponível; a
 *                  estimativa só é usada onde não há voz
 */
export function buildCutsceneTimeline(
  scene: Cutscene,
  durations?: readonly (number | undefined)[],
): CutsceneTimeline {
  // A direção decide o enquadramento de cada fala (quem fala define onde a
  // câmera fica) e a pausa dramática depois dela. Continua determinístico.
  const direction = directScene(scene);
  let at = 0;
  const lines: TimelineLine[] = scene.lines.map((line, index) => {
    const voiced = durations?.[index];
    const reading = estimateLineDuration(line);
    const beat = direction.lines[index]!.pause;
    // a voz manda quando existe: a fala dura o áudio (com folga para a pausa)
    const duration =
      voiced && voiced > 0.2
        ? Math.min(MAX_LINE + 4, voiced + PAUSE[line.who] + beat)
        : Math.min(MAX_LINE + 4, reading + beat);
    const shot = SHOTS[shotIndexFor(direction.lines[index]!, scene.id, SHOTS)]!;
    const timelineLine: TimelineLine = {
      index,
      who: line.who,
      text: line.text,
      at,
      duration,
      // o texto termina antes do fim da fala, para a leitura respirar
      typedUntil: 0.72,
      shot,
      voiced: Boolean(voiced && voiced > 0.2),
    };
    at += duration;
    return timelineLine;
  });
  return { id: scene.id, lines, duration: Math.max(0, at) };
}

/** Linha ativa num instante `t` (sempre devolve uma, mesmo depois do fim). */
export function lineAt(timeline: CutsceneTimeline, t: number): TimelineLine {
  if (timeline.lines.length === 0) throw new Error("cutscene sem falas");
  for (const line of timeline.lines) {
    if (t < line.at + line.duration) return line;
  }
  return timeline.lines[timeline.lines.length - 1]!;
}

/** Estado completo da cena num instante `t`. */
export function sampleCutsceneTimeline(timeline: CutsceneTimeline, t: number): TimelineSample {
  const time = Math.max(0, t);
  const line = lineAt(timeline, time);
  const local = Math.min(1, (time - line.at) / Math.max(0.001, line.duration));
  const typedRatio = Math.min(1, local / line.typedUntil);
  return {
    lineIndex: line.index,
    line,
    local,
    typed: Math.round(typedRatio * line.text.length),
    dolly: smoothstep(local),
    finished: time >= timeline.duration,
  };
}

/**
 * Instante do início da próxima fala — o "pular" do jogador. Se o texto ainda
 * está sendo digitado, o primeiro toque só completa a digitação (regra que o
 * motor antigo tinha e as pessoas esperam).
 */
export function advanceTarget(timeline: CutsceneTimeline, t: number, typed: number): number {
  const line = lineAt(timeline, t);
  if (typed < line.text.length) return line.at + line.duration * line.typedUntil;
  const next = timeline.lines[line.index + 1];
  return next ? next.at : timeline.duration;
}

/** Humor dominante de uma cena (usado pelo palco 3D e pelo pós-processamento). */
export function timelineMood(scene: Cutscene): SceneMood {
  return scene.mood ?? "neutral";
}
