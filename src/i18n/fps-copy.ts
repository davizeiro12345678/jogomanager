import type { Lang } from "./locale-catalog";

export interface FpsCopy {
  locale: "pt" | "en";
  average: string;
  current: string;
  worstSecond: string;
  onePercentLow: string;
  pointOnePercentLow: string;
  measuredTime: string;
  framesAndTime: string;
  preciseAverage: string;
  p50: string;
  p95: string;
  p99: string;
  maxFrame: string;
  over33: string;
  over50: string;
  over100: string;
  over250: string;
  renderedSource: string;
  rafSource: string;
  measuredPhase: string;
  measuredPreset: string;
  measuredCamera: string;
  measuredScenario: string;
  browser: string;
  cores: string;
  screen: string;
  preset: string;
  phase: string;
  suspended: string;
  copied: string;
  copyResult: string;
  renderedWindow: (seconds: number, quality: string) => string;
  rafWindow: (seconds: number) => string;
}

const ENGLISH: FpsCopy = {
  locale: "en",
  average: "Average FPS",
  current: "Current FPS",
  worstSecond: "Worst second",
  onePercentLow: "1% low",
  pointOnePercentLow: "0.1% low",
  measuredTime: "Measured time",
  framesAndTime: "Frames / active time",
  preciseAverage: "Precise average FPS",
  p50: "Frame time p50",
  p95: "Frame time p95",
  p99: "Frame time p99",
  maxFrame: "Slowest frame",
  over33: "Frames >33.33 ms",
  over50: "Frames >50 ms",
  over100: "Frames >100 ms",
  over250: "Frames >250 ms",
  renderedSource: "Source: post-render stadium frames; no physical GPU certification",
  rafSource: "Source: requestAnimationFrame; browser pacing, not stadium frames",
  measuredPhase: "Measured phase",
  measuredPreset: "Measured preset",
  measuredCamera: "Measured camera",
  measuredScenario: "Measured scenario",
  browser: "Browser",
  cores: "Cores",
  screen: "Screen",
  preset: "Graphics preset",
  phase: "Phase",
  suspended: "Measurement paused outside the active match.",
  copied: "Copied",
  copyResult: "Copy result",
  renderedWindow: (seconds, quality) => `${seconds}s of stadium render frames · ${quality}`,
  rafWindow: (seconds) => `${seconds}s of browser pacing (RAF)`,
};

const PORTUGUESE: FpsCopy = {
  locale: "pt",
  average: "FPS médio",
  current: "FPS agora",
  worstSecond: "Pior segundo",
  onePercentLow: "1% piores quadros",
  pointOnePercentLow: "0,1% piores quadros",
  measuredTime: "Tempo medido",
  framesAndTime: "Quadros/tempo ativo",
  preciseAverage: "FPS médio preciso",
  p50: "Frame time p50",
  p95: "Frame time p95",
  p99: "Frame time p99",
  maxFrame: "Pior quadro",
  over33: "Quadros >33,33 ms",
  over50: "Quadros >50 ms",
  over100: "Quadros >100 ms",
  over250: "Quadros >250 ms",
  renderedSource: "Origem: quadros do renderizador após render; sem certificação de GPU física",
  rafSource: "Origem: requestAnimationFrame; ritmo do navegador, não frames do estádio",
  measuredPhase: "Fase medida",
  measuredPreset: "Preset medido",
  measuredCamera: "Câmera medida",
  measuredScenario: "Cenário medido",
  browser: "Navegador",
  cores: "Núcleos",
  screen: "Tela",
  preset: "Nível gráfico",
  phase: "Fase",
  suspended: "Medição suspensa fora da partida ativa.",
  copied: "Copiado",
  copyResult: "Copiar resultado",
  renderedWindow: (seconds, quality) => `${seconds}s de quadros do estádio · ${quality}`,
  rafWindow: (seconds) => `${seconds}s de ritmo do navegador (RAF)`,
};

/** Only Portuguese and English copy is supplied here. Other selected locales
 * deliberately use English; this does not claim native-language coverage. */
export function fpsCopy(lang: Lang): FpsCopy {
  return lang === "pt-BR" || lang === "pt-PT" ? PORTUGUESE : ENGLISH;
}
