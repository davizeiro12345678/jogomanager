import { FpsWindow } from "./fps-window";
import { fpsCopy } from "@/i18n/fps-copy";
import type { Lang } from "@/i18n/locale-catalog";

/**
 * Medidor de quadros do aparelho real do jogador.
 *
 * O ambiente de desenvolvimento roda por software e não representa uma placa
 * de vídeo de verdade; por isso a medição precisa acontecer no navegador do
 * próprio jogador. O medidor observa o relógio entre quadros (sem desenhar
 * nada) e guarda uma janela deslizante dos últimos segundos.
 */

export interface FpsSample {
  /** quadros por segundo do último segundo */
  now: number;
  /** média da janela observada */
  avg: number;
  /** pior segundo da janela (o que o jogador sente como travada) */
  worst: number;
  /** percentil 1% baixo: média dos 1% piores quadros */
  low1: number;
  /** segundos já medidos */
  seconds: number;
  /** Additional diagnostics are optional for callers holding legacy samples. */
  frames?: number;
  windowMs?: number;
  low01?: number;
  p50FrameMs?: number;
  p95FrameMs?: number;
  p99FrameMs?: number;
  maxFrameMs?: number;
  framesOver33Ms?: number;
  framesOver50Ms?: number;
  framesOver100Ms?: number;
  framesOver250Ms?: number;
  source?: "raf" | "rendered";
  measurementKey?: string;
  phase?: string;
  quality?: string;
  camera?: string;
}

export interface FpsMeasurementContext {
  key: string;
  phase: string;
  quality: string;
  camera?: string;
}

type Listener = (s: FpsSample) => void;

export class FpsMeter {
  private readonly window = new FpsWindow();
  private listeners = new Set<Listener>();
  private raf = 0;
  private last = 0;
  private running = false;
  private warmupMs = 2000;
  private resumePending = false;
  private source: "raf" | "rendered" = "raf";
  private context: FpsMeasurementContext | undefined;
  private renderedLast: number | null = null;

  private visibilityChanged = () => {
    // RAF may stop completely in a hidden tab. Remember the transition instead
    // of classifying a large, otherwise visible delta as a background pause.
    this.resumePending = true;
    this.window.resetPartialSecond();
    this.warmupMs = 2000;
  };

  start(source: "raf" | "rendered" = "raf", context?: FpsMeasurementContext) {
    if (
      this.running ||
      typeof document === "undefined" ||
      (source === "raf" && typeof requestAnimationFrame === "undefined")
    )
      return;
    if (source !== this.source || context?.key !== this.context?.key) this.window.reset();
    this.running = true;
    this.source = source;
    this.context = context;
    this.renderedLast = null;
    this.last = performance.now();
    this.resumePending = false;
    this.warmupMs = 2000;
    this.window.resetPartialSecond();
    document.addEventListener("visibilitychange", this.visibilityChanged);
    if (source === "rendered") return;
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = t - this.last;
      this.last = t;
      // Aba em segundo plano, retomada e aquecimento não contaminam a medição.
      if (document.hidden || this.resumePending || !Number.isFinite(dt) || dt <= 0) {
        this.window.resetPartialSecond();
        this.resumePending = document.hidden;
      } else if (this.warmupMs > 0) {
        this.warmupMs = Math.max(0, this.warmupMs - dt);
      } else if (this.window.add(dt)) this.emit();
      if (this.running) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Only an opted-in renderer can advance this measurement, never a RAF or
   * another Canvas. The first completed render establishes the time origin. */
  recordRenderedFrame(t: number, context?: FpsMeasurementContext) {
    if (!this.running || this.source !== "rendered" || !Number.isFinite(t)) return;
    if (context && context.key !== this.context?.key) {
      this.reset();
      this.context = context;
      this.emit();
    }
    if (this.renderedLast === null) {
      this.renderedLast = t;
      return;
    }
    const dt = t - this.renderedLast;
    this.renderedLast = t;
    if (document.hidden || this.resumePending || !Number.isFinite(dt) || dt <= 0) {
      this.window.resetPartialSecond();
      this.resumePending = document.hidden;
    } else if (this.warmupMs > 0) {
      this.warmupMs = Math.max(0, this.warmupMs - dt);
    } else if (this.window.add(dt)) this.emit();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.source === "raf") cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.visibilityChanged);
  }

  reset() {
    this.window.reset();
    this.warmupMs = 2000;
    this.resumePending = this.running;
    this.renderedLast = null;
  }

  sample(): FpsSample {
    const metrics = this.window.summary();
    return {
      ...metrics,
      now: Math.round(metrics.now),
      avg: Math.round(metrics.fps),
      worst: Math.round(metrics.worst),
      low1: Math.round(metrics.low1),
      seconds: Math.round(metrics.windowMs / 1000),
      source: this.source,
      ...(this.context
        ? {
            measurementKey: this.context.key,
            phase: this.context.phase,
            quality: this.context.quality,
            ...(this.context.camera === undefined ? {} : { camera: this.context.camera }),
          }
        : {}),
    };
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const s = this.sample();
    for (const fn of this.listeners) fn(s);
  }
}

export const fpsMeter = new FpsMeter();

/** Texto pronto para o jogador copiar e enviar. */
export function fpsReport(
  s: FpsSample,
  extra: Record<string, string | number>,
  lang: Lang = "pt-BR",
): string {
  const copy = fpsCopy(lang);
  const lines = [
    `${copy.average}: ${s.avg}`,
    `${copy.current}: ${s.now}`,
    `${copy.worstSecond}: ${s.worst}`,
    `${copy.onePercentLow}: ${s.low1}`,
    `${copy.measuredTime}: ${s.seconds}s`,
  ];
  if (s.source) lines.push(s.source === "rendered" ? copy.renderedSource : copy.rafSource);
  if (s.phase) lines.push(`${copy.measuredPhase}: ${s.phase}`);
  if (s.quality) lines.push(`${copy.measuredPreset}: ${s.quality}`);
  if (s.camera) lines.push(`${copy.measuredCamera}: ${s.camera}`);
  if (s.measurementKey) lines.push(`${copy.measuredScenario}: ${s.measurementKey}`);
  if (s.frames !== undefined && s.windowMs !== undefined) {
    lines.push(`${copy.framesAndTime}: ${s.frames} / ${s.windowMs.toFixed(3)} ms`);
    lines.push(
      `${copy.preciseAverage}: ${s.windowMs > 0 ? ((s.frames * 1000) / s.windowMs).toFixed(3) : "0"}`,
    );
  }
  const diagnosticLines: [string, number | undefined, string][] = [
    [copy.pointOnePercentLow, s.low01, " FPS"],
    [copy.p50, s.p50FrameMs, " ms"],
    [copy.p95, s.p95FrameMs, " ms"],
    [copy.p99, s.p99FrameMs, " ms"],
    [copy.maxFrame, s.maxFrameMs, " ms"],
    [copy.over33, s.framesOver33Ms, ""],
    [copy.over50, s.framesOver50Ms, ""],
    [copy.over100, s.framesOver100Ms, ""],
    [copy.over250, s.framesOver250Ms, ""],
  ];
  for (const [label, value, unit] of diagnosticLines)
    if (value !== undefined) lines.push(`${label}: ${Number(value.toFixed(3))}${unit}`);
  for (const [k, v] of Object.entries(extra)) lines.push(`${k}: ${v}`);
  if (typeof navigator !== "undefined") {
    lines.push(`${copy.browser}: ${navigator.userAgent}`);
    const cores = navigator.hardwareConcurrency;
    if (cores) lines.push(`${copy.cores}: ${cores}`);
  }
  if (typeof window !== "undefined") {
    lines.push(
      `${copy.screen}: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}`,
    );
  }
  return lines.join("\n");
}
