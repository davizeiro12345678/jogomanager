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

/** Follow OS/accessibility changes while a cinematic stays open. */
export function watchReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof matchMedia === "undefined") return () => undefined;
  const query = matchMedia("(prefers-reduced-motion: reduce)");
  const change = (event: MediaQueryListEvent) => onChange(event.matches);
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }
  query.addListener(change);
  return () => query.removeListener(change);
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
    if (q === "alta") return [0.8, 1.15];
    if (q === "media") return [0.7, 0.95];
    return [0.62, 0.8];
  }
  if (q === "alta") return [0.95, 1.5];
  if (q === "media") return [0.8, 1.2];
  return 0.7;
}

/**
 * Refino por placa de vídeo real (`detect-gpu` compara o modelo com uma tabela
 * de desempenho medido). A heurística acima responde na hora; esta versão
 * chega alguns milissegundos depois e corrige casos como notebook com muitos
 * núcleos e vídeo integrado fraco, ou celular novo com GPU forte.
 */
let gpuTier: Promise<QualityLevel> | null = null;

export function detectQualityByGpu(): Promise<QualityLevel> {
  if (gpuTier) return gpuTier;
  gpuTier = (async () => {
    const fallback = detectQuality();
    if (typeof navigator === "undefined") return fallback;
    try {
      const { getGPUTier } = await import("detect-gpu");
      const tier = await getGPUTier({ failIfMajorPerformanceCaveat: false });
      if (tier.type === "BLOCKLISTED" || tier.tier <= 1) return "baixa";
      if (tier.tier === 2) return fallback === "baixa" ? "baixa" : "media";
      return fallback === "baixa" ? "media" : "alta";
    } catch {
      return fallback;
    }
  })();
  return gpuTier;
}

/** Um degrau abaixo/acima na escala de qualidade. */
export function lowerQuality(q: QualityLevel): QualityLevel {
  return q === "alta" ? "media" : "baixa";
}
export function higherQuality(q: QualityLevel): QualityLevel {
  return q === "baixa" ? "media" : "alta";
}
