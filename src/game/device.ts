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
  const small = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 500;

  if (cores <= 4 || mem <= 3 || (mobile && small)) return "baixa";
  if (mobile || cores <= 6 || mem <= 6) return "media";
  return cores >= 8 ? "alta" : "media";
}

/** Limite de pixels por qualidade — evita queimar GPU de celular. */
export function dprFor(q: QualityLevel): number | [number, number] {
  if (q === "alta") return [1, 2];
  if (q === "media") return [1, 1.5];
  return 0.75;
}
