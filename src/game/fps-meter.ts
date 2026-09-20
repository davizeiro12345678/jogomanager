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
}

type Listener = (s: FpsSample) => void;

const WINDOW_SECONDS = 30;

class FpsMeter {
  private frames: number[] = []; // duração de cada quadro (ms), janela deslizante
  private perSecond: number[] = []; // fps fechado de cada segundo
  private listeners = new Set<Listener>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private countInSecond = 0;
  private running = false;
  private warmupMs = 2000;

  start() {
    if (this.running || typeof requestAnimationFrame === "undefined") return;
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = t - this.last;
      this.last = t;
      // Aba em segundo plano, retomada e aquecimento não contaminam a medição.
      if (document.hidden || dt <= 0 || dt > 250) {
        this.acc = 0;
        this.countInSecond = 0;
      } else if (this.warmupMs > 0) {
        this.warmupMs = Math.max(0, this.warmupMs - dt);
      } else {
        this.frames.push(dt);
        if (this.frames.length > 60 * WINDOW_SECONDS) {
          this.frames.splice(0, this.frames.length - 60 * WINDOW_SECONDS);
        }
        this.acc += dt;
        this.countInSecond++;
        if (this.acc >= 1000) {
          this.perSecond.push((this.countInSecond * 1000) / this.acc);
          if (this.perSecond.length > WINDOW_SECONDS) this.perSecond.shift();
          this.acc = 0;
          this.countInSecond = 0;
          this.emit();
        }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  reset() {
    this.frames = [];
    this.perSecond = [];
    this.acc = 0;
    this.countInSecond = 0;
    this.warmupMs = 2000;
  }

  sample(): FpsSample {
    const secs = this.perSecond;
    const now = secs.length ? secs[secs.length - 1]! : 0;
    const avg = secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : 0;
    const worst = secs.length ? Math.min(...secs) : 0;
    // 1% low: média dos piores 1% de quadros da janela, convertida em fps
    const sorted = [...this.frames].sort((a, b) => b - a);
    const slice = sorted.slice(0, Math.max(1, Math.round(sorted.length * 0.01)));
    const worstMs = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
    return {
      now: Math.round(now),
      avg: Math.round(avg),
      worst: Math.round(worst),
      low1: worstMs > 0 ? Math.round(1000 / worstMs) : 0,
      seconds: secs.length,
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
export function fpsReport(s: FpsSample, extra: Record<string, string | number>): string {
  const lines = [
    `FPS médio: ${s.avg}`,
    `FPS agora: ${s.now}`,
    `Pior segundo: ${s.worst}`,
    `1% piores quadros: ${s.low1}`,
    `Tempo medido: ${s.seconds}s`,
  ];
  for (const [k, v] of Object.entries(extra)) lines.push(`${k}: ${v}`);
  if (typeof navigator !== "undefined") {
    lines.push(`Navegador: ${navigator.userAgent}`);
    const cores = navigator.hardwareConcurrency;
    if (cores) lines.push(`Núcleos: ${cores}`);
  }
  if (typeof window !== "undefined") {
    lines.push(`Tela: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}`);
  }
  return lines.join("\n");
}
