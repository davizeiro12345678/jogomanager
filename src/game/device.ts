/**
 * Detecção de capacidade do aparelho para escolher o nível gráfico
 * automaticamente (celular/tablet entram em qualidade menor).
 */
export type QualityLevel = "baixa" | "media" | "alta";

export function isCoarsePointer() {
  if (typeof matchMedia === "undefined") return false;
  return matchMedia("(pointer: coarse)").matches;
}

export function prefersReducedMotion() {
  if (typeof matchMedia === "undefined") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Heurística: núcleos, memória e tipo de ponteiro. */
export function detectQuality(): QualityLevel {
  if (typeof navigator === "undefined") return "media";
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const mobile = isCoarsePointer();
  const small =
    typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 500;

  if (cores <= 4 || mem <= 3 || (mobile && small)) return "baixa";
  if (mobile || cores <= 6 || mem <= 6) return "media";
  return cores >= 8 ? "alta" : "media";
}

/**
 * Limite de pixels por qualidade. No celular/tablet a faixa é bem mais
 * estreita (0,7–1,25) para segurar a temperatura e manter os quadros suaves.
 */
export function dprFor(q: QualityLevel): number | [number, number] {
  const mobile = isCoarsePointer();
  if (mobile) {
    if (q === "alta") return [0.85, 1.25];
    if (q === "media") return [0.75, 1.1];
    return [0.7, 0.9];
  }
  if (q === "alta") return [1, 2];
  if (q === "media") return [1, 1.5];
  return 0.75;
}

/** Um degrau abaixo/acima na escala de qualidade. */
export function lowerQuality(q: QualityLevel): QualityLevel {
  return q === "alta" ? "media" : "baixa";
}
export function higherQuality(q: QualityLevel): QualityLevel {
  return q === "baixa" ? "media" : "alta";
}
