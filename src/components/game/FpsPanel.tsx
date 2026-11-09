import { useEffect, useRef, useState } from "react";
import { Activity, Check, Copy } from "lucide-react";

import { fpsMeter, fpsReport, type FpsSample } from "@/game/fps-meter";

const EMPTY: FpsSample = { now: 0, avg: 0, worst: 0, low1: 0, seconds: 0 };

function tone(v: number) {
  if (v >= 50) return "text-emerald-300";
  if (v >= 30) return "text-amber-300";
  return "text-rose-300";
}

/**
 * Painel de quadros por segundo medido no aparelho do jogador.
 * Fica recolhido por padrão e pode ser copiado para diagnóstico.
 */
export function FpsPanel({
  quality,
  detail,
  active = true,
  source = "raf",
  measurementKey = quality,
  phase = "match",
}: {
  quality: string;
  detail?: Record<string, string | number>;
  active?: boolean;
  source?: "raf" | "rendered";
  measurementKey?: string;
  phase?: string;
}) {
  const epoch = `${source}:${measurementKey}:${active}`;
  const [measured, setMeasured] = useState({ epoch: "", sample: EMPTY });
  const sample = active && measured.epoch === epoch ? measured.sample : EMPTY;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const detailRef = useRef(detail);
  detailRef.current = detail;

  useEffect(() => {
    fpsMeter.stop();
    fpsMeter.reset();
    if (!active) return;
    const off = fpsMeter.subscribe((next) => setMeasured({ epoch, sample: next }));
    fpsMeter.start(source, { key: measurementKey, phase, quality });
    return () => {
      off();
      fpsMeter.stop();
    };
  }, [active, source, measurementKey, phase, quality, epoch]);

  async function copy() {
    const text = fpsReport(sample, {
      "Nível gráfico": sample.quality ?? quality,
      Fase: sample.phase ?? phase,
      ...(detailRef.current ?? {}),
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pointer-events-auto rounded-xl bg-black/55 p-2 text-white shadow-lg ring-1 ring-white/10 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <Activity size={13} className="opacity-70" aria-hidden />
        <span className={`tabular font-display text-sm ${tone(sample.now)}`}>
          {sample.now || "--"}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">fps</span>
      </button>

      {open ? (
        <div className="mt-2 space-y-1 text-[11px] text-white/80">
          <p role="status" aria-live="polite">
            Média <strong className={tone(sample.avg)}>{sample.avg || "--"}</strong> · pior segundo{" "}
            <strong className={tone(sample.worst)}>{sample.worst || "--"}</strong> · 1% piores{" "}
            <strong className={tone(sample.low1)}>{sample.low1 || "--"}</strong>
          </p>
          <p className="text-white/50">
            {active
              ? source === "rendered"
                ? `${sample.seconds}s de quadros do estádio · ${sample.quality ?? quality}`
                : `${sample.seconds}s de ritmo do navegador (RAF)`
              : "Medição suspensa fora da partida ativa."}
          </p>
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!active || !sample.frames}
            className="mt-1 flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
          >
            {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
            {copied ? "Copiado" : "Copiar resultado"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
