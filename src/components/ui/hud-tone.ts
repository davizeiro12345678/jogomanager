/**
 * HUD analítico — peças visuais compartilhadas por todas as telas do jogo.
 *
 * Todas as cores saem de tokens semânticos (`--hud-tone`, definido pelas
 * classes `tone-good`/`tone-warn`/`tone-bad`/`tone-neutral`), para que o
 * mesmo componente sirva a qualquer seção sem cor fixa no código.
 */

export type Tone = "good" | "warn" | "bad" | "neutral";

export const toneClass: Record<Tone, string> = {
  good: "tone-good",
  warn: "tone-warn",
  bad: "tone-bad",
  neutral: "tone-neutral",
};

/** Converte um valor 0–100 em tom de desempenho. */
export function toneFor(value: number, { good = 66, warn = 40 } = {}): Tone {
  if (!Number.isFinite(value)) return "neutral";
  if (value >= good) return "good";
  if (value >= warn) return "warn";
  return "bad";
}
