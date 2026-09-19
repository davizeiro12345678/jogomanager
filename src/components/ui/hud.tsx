/**
 * HUD analítico — peças visuais compartilhadas por todas as telas do jogo.
 *
 * Todas as cores saem de tokens semânticos (`--hud-tone`, definido pelas
 * classes `tone-good`/`tone-warn`/`tone-bad`/`tone-neutral`), para que o
 * mesmo componente sirva a qualquer seção sem cor fixa no código.
 */
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Número que conta até o valor final quando muda. */
export function CountUp({
  value,
  decimals = 0,
  format,
  duration = 650,
  className,
}: {
  value: number;
  decimals?: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration, reduced]);

  const text = format ? format(shown) : shown.toFixed(decimals);
  return <span className={cn("hud-num", className)}>{text}</span>;
}

/** Cartão de vidro com borda que reage ao desempenho. */
export function HudCard({
  title,
  tone = "neutral",
  badge,
  action,
  className,
  bodyClassName,
  interactive = true,
  children,
}: {
  title?: string;
  tone?: Tone;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  interactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={title ?  : undefined} className={cn(
        "hud-card p-4 sm:p-5",
        toneClass[tone],
        interactive && "hud-card-interactive",
        className,
      )}
    >
      {(title || badge || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 id={`hud-title-${title.replace(/\s/g, "-")}`} className="hud-label">{title}</h2> : <span />}
          <div className="flex items-center gap-2">
            {badge}
            {action}
          </div>
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Etiqueta pequena no tom do cartão. */
export function HudChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "hud-num border-tone rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-tone",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Barra de progresso com rótulo e valor. */
export function HudBar({
  label,
  value,
  suffix = "%",
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: Tone;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("space-y-1.5", tone && toneClass[tone])}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="hud-num font-bold text-tone">
          <CountUp value={pct} />
          {suffix}
        </span>
      </div>
      <div className="hud-bar">
        <div className="hud-bar-fill" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

/** Micrográfico de linha para qualquer série numérica. */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
  filled = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  filled?: boolean;
}) {
  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("overflow-visible", className)}
        aria-hidden
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1]!;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-tone overflow-visible", className)}
      aria-hidden
    >
      {filled && <path d={area} fill="currentColor" fillOpacity={0.14} />}
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill="currentColor" />
    </svg>
  );
}

/** Micrográfico de barras (gols por jogo, receitas etc.). */
export function SparkBars({
  data,
  height = 34,
  className,
}: {
  data: number[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d)));
  return (
    <div className={cn("flex items-end gap-1", className)} style={{ height }} aria-hidden>
      {data.map((v, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-t-sm",
            v < 0 ? "bg-destructive/50" : "bg-tone",
            i === data.length - 1 ? "opacity-100" : "opacity-55",
          )}
          style={{ height: `${Math.max(6, (Math.abs(v) / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** Anel de porcentagem (confiança, condição, objetivo). */
export function HudRing({
  value,
  size = 88,
  label,
  sub,
}: {
  value: number;
  size?: number;
  label?: string;
  sub?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 text-tone">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.14}
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset 800ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute text-center leading-none">
        <p className="hud-num text-xl font-bold">
          <CountUp value={pct} />
        </p>
        {label && <p className="mt-1 text-[10px] uppercase text-muted-foreground">{label}</p>}
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/** Sequência de resultados V/E/D. */
export function FormPips({ results }: { results: string[] }) {
  if (results.length === 0)
    return <span className="text-sm text-muted-foreground">Sem jogos ainda.</span>;
  return (
    <div className="flex gap-1.5">
      {results.map((r, i) => (
        <span
          key={i}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg border font-display text-sm font-bold",
            r === "V"
              ? "border-primary/60 bg-primary/15 text-primary"
              : r === "E"
                ? "border-border bg-muted/40 text-muted-foreground"
                : "border-destructive/60 bg-destructive/15 text-destructive",
          )}
          title={r === "V" ? "Vitória" : r === "E" ? "Empate" : "Derrota"}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

/** Valor grande com rótulo, usado em faixas de estatística. */
export function HudStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className={cn("min-w-0", tone && toneClass[tone])}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="hud-num mt-0.5 truncate text-xl font-bold text-foreground">{value}</p>
      {hint && <p className="truncate text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
