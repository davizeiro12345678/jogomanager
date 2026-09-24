import { readConsent } from "./consent";
import { sendTechTelemetry } from "./telemetry.functions";

const SENT = "pfm-telemetry-sent";

function browserFamily() {
  const ua = navigator.userAgent;
  if (/SamsungBrowser/.test(ua)) return "samsung" as const;
  if (/Edg\//.test(ua)) return "edge" as const;
  if (/Firefox\//.test(ua)) return "firefox" as const;
  if (/Chrome\//.test(ua)) return "chrome" as const;
  if (/Safari\//.test(ua)) return "safari" as const;
  return "outro" as const;
}

/** Envia no máximo um resumo por sessão, e só com consentimento. */
export function reportTechSample(sample: { fps: number; p95: number; errorCode?: string }) {
  if (typeof window === "undefined" || !readConsent().telemetry) return;
  if (sessionStorage.getItem(SENT)) return;
  sessionStorage.setItem(SENT, "1");
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  void sendTechTelemetry({
    data: {
      fpsAvg: Math.round(sample.fps * 10) / 10,
      frameTimeP95Ms: Math.round(sample.p95 * 10) / 10,
      browser: browserFamily(),
      gpuTier: null,
      graphicsPreset: "auto",
      loadTimeMs: nav ? Math.round(nav.loadEventEnd || nav.domContentLoadedEventEnd) : null,
      errorCode: sample.errorCode ?? null,
      appVersion: "1.0.0",
    },
  }).catch(() => undefined);
}
