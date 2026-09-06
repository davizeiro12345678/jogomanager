/**
 * Cutscene 2D: cenário ilustrado em SVG + falas em sequência.
 * Puláveis, com avanço por clique e respeitando "reduzir movimento".
 */
import { useEffect, useState } from "react";

import { CUTSCENES, type Cutscene as SceneData, type SceneArt } from "@/content/cutscenes";
import { ManagerPortrait } from "@/components/game/ManagerPortrait";
import { prefersReducedMotion } from "@/game/device";
import type { ManagerLook } from "@/game/types";

interface Props {
  scene: keyof typeof CUTSCENES | string;
  look: ManagerLook;
  accent?: string;
  accent2?: string;
  onDone: () => void;
}

function Backdrop({ art, a, b }: { art: SceneArt; a: string; b: string }) {
  return (
    <svg viewBox="0 0 400 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a} stopOpacity="0.85" />
          <stop offset="100%" stopColor={b} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#cs-sky)" />
      {art === "arrival" && (
        <>
          <rect x="20" y="70" width="360" height="90" fill="#0e1620" opacity="0.75" />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={30 + i * 25} y={80} width="14" height="20" fill={a} opacity="0.5" />
          ))}
          <rect x="0" y="160" width="400" height="40" fill="#101a12" />
        </>
      )}
      {art === "press" && (
        <>
          <rect x="0" y="60" width="400" height="140" fill="#0d1218" opacity="0.85" />
          {Array.from({ length: 10 }).map((_, i) => (
            <circle key={i} cx={25 + i * 40} cy={100 + (i % 3) * 12} r="9" fill="#ffffff" opacity="0.12" />
          ))}
          <rect x="140" y="130" width="120" height="70" rx="6" fill={b} opacity="0.5" />
        </>
      )}
      {art === "dressing" && (
        <>
          <rect x="0" y="50" width="400" height="150" fill="#111a22" opacity="0.9" />
          {Array.from({ length: 6 }).map((_, i) => (
            <rect key={i} x={30 + i * 60} y={70} width="34" height="52" rx="4" fill={a} opacity="0.6" />
          ))}
          <rect x="0" y="150" width="400" height="50" fill="#0b1015" />
        </>
      )}
      {art === "trophy" && (
        <>
          <rect x="0" y="120" width="400" height="80" fill="#0d1a12" />
          {Array.from({ length: 40 }).map((_, i) => (
            <rect
              key={i}
              x={(i * 37) % 400}
              y={(i * 23) % 120}
              width="4"
              height="9"
              fill={i % 2 ? a : b}
              opacity="0.7"
            />
          ))}
        </>
      )}
    </svg>
  );
}

export function Cutscene({ scene, look, accent = "#0a8f3c", accent2 = "#0b1220", onDone }: Props) {
  const data: SceneData | undefined = CUTSCENES[scene];
  const [i, setI] = useState(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (!data) onDone();
  }, [data, onDone]);
  if (!data) return null;

  const line = data.lines[i]!;
  const speaker =
    line.who === "manager"
      ? "Você"
      : line.who === "president"
        ? "Presidente"
        : line.who === "press"
          ? "Imprensa"
          : line.who === "captain"
            ? "Capitão"
            : "";

  function next() {
    if (i + 1 >= data!.lines.length) onDone();
    else setI(i + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
      <div
        className={`w-full max-w-2xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl ${
          reduced ? "" : "animate-scale-in"
        }`}
      >
        <div className="relative h-44 sm:h-56">
          <Backdrop art={data.art} a={accent} b={accent2} />
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <ManagerPortrait look={look} size={72} accent={accent} />
            <p className="font-display text-xl uppercase tracking-wide drop-shadow">{data.title}</p>
          </div>
        </div>

        <button onClick={next} className="block w-full p-5 text-left">
          {speaker && (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{speaker}</p>
          )}
          <p key={i} className={`mt-1 text-lg ${reduced ? "" : "animate-fade-in"}`}>{line.text}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Toque para continuar ({i + 1}/{data.lines.length})
          </p>
        </button>

        <div className="flex justify-end border-t border-border/60 p-3">
          <button
            onClick={onDone}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Pular cena
          </button>
        </div>
      </div>
    </div>
  );
}
