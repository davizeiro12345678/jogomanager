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
}: {
  quality: string;
  detail?: Record<string, string | number>;
}) {
  const [sample, setSample] = useState<FpsSample>(EMPTY);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const detailRef = useRef(detail);
  detailRef.current = detail;

  useEffect(() => {
    fpsMeter.start();
    const off = fpsMeter.subscribe(setSample);
    return () => {
      off();
      fpsMeter.stop();
    };
  }, []);

  async function copy() {
    const text = fpsReport(sample, { "Nível gráfico": quality, ...(detailRef.current ?? {}) });
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
          <p className="text-white/50">Medindo há {sample.seconds}s no seu aparelho.</p>
          <button
            type="button"
            onClick={() => void copy()}
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
