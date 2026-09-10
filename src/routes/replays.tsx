import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GameShell } from "@/components/game/GameShell";
import { Stadium3D, type CameraMode, type Quality } from "@/components/game/Stadium3D";
import { detectQuality } from "@/game/device";
import {
  canExportVideo,
  deleteReplay,
  listReplays,
  recordCanvas,
  ReplaySim,
  type Replay,
} from "@/game/replay";
import { useCareer } from "@/hooks/useCareer";

export const Route = createFileRoute("/replays")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Galeria de replays · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:title", content: "Galeria de replays · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      { property: "og:description", content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReplaysPage,
});

const CAMERAS: [CameraMode, string][] = [
  ["broadcast", "Transmissão"],
  ["goal", "Atrás do gol"],
  ["tactical", "Tática"],
  ["fan", "Torcida"],
  ["rail", "Rente ao campo"],
];

function ReplaysPage() {
  const { career } = useCareer();
  const [list, setList] = useState<Replay[] | null>(null);
  const [current, setCurrent] = useState<Replay | null>(null);

  useEffect(() => {
    void listReplays().then(setList);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteReplay(id);
    setList(await listReplays());
    setCurrent((c) => (c?.id === id ? null : c));
  }, []);

  const body = (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl uppercase tracking-wide">Galeria de replays</h1>
        <p className="text-sm text-muted-foreground">
          As últimas 20 partidas ficam guardadas no aparelho. Reveja em 3D, troque a câmera e
          exporte o vídeo.
        </p>
      </header>

      {current ? (
        <ReplayPlayer replay={current} onClose={() => setCurrent(null)} />
      ) : list === null ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-border/60 bg-card/60 p-5 text-sm text-muted-foreground">
          Nenhuma repetição ainda. Jogue uma partida e ela aparece aqui automaticamente.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border/60 bg-card/70 p-4"
            >
              <p className="font-display text-lg uppercase tracking-wide">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()} · {Math.round(r.frames.length / 4)}s de jogo
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrent(r)}
                  className="rounded-lg bg-primary px-3 py-1.5 font-display text-xs uppercase tracking-wider text-primary-foreground"
                >
                  Assistir
                </button>
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  className="rounded-lg border border-border/60 px-3 py-1.5 font-display text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return career ? <GameShell career={career}>{body}</GameShell> : (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-5xl">{body}</div>
    </div>
  );
}

function ReplayPlayer({ replay, onClose }: { replay: Replay; onClose: () => void }) {
  const sim = useMemo(() => new ReplaySim(replay), [replay]);
  const [camera, setCamera] = useState<CameraMode>("broadcast");
  const [quality] = useState<Quality>(() => detectQuality() as Quality);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [t, setT] = useState(0);
  const [recording, setRecording] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<null | (() => Promise<Blob>)>(null);

  sim.speed = speed;

  useEffect(() => {
    let raf = 0;
    let last = 0;
    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      if (!playing) return;
      sim.step(dt);
      setT(sim.time);
      if (sim.finished) setPlaying(false);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, playing]);

  const exportVideo = useCallback(async () => {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    if (recording && stopRef.current) {
      const blob = await stopRef.current();
      stopRef.current = null;
      setRecording(false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${replay.title.replace(/\s+/g, "-").toLowerCase()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return;
    }
    const rec = recordCanvas(canvas);
    stopRef.current = rec.stop;
    setRecording(true);
  }, [recording, replay.title]);

  const dur = sim.duration || 1;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg uppercase tracking-wide">{replay.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg border border-border/60 px-3 py-1.5 font-display text-xs uppercase tracking-wider text-muted-foreground"
        >
          Voltar
        </button>
      </div>

      <div ref={wrapRef} className="mt-3 h-[420px] overflow-hidden rounded-xl">
        <Stadium3D sim={sim} mode={camera} quality={quality} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (sim.finished) sim.seek(0);
            setPlaying((p) => !p);
          }}
          className="rounded-lg bg-primary px-3 py-1.5 font-display text-xs uppercase tracking-wider text-primary-foreground"
        >
          {playing ? "Pausar" : "Reproduzir"}
        </button>
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`rounded-lg px-2.5 py-1.5 font-display text-xs uppercase tracking-wider ${
              speed === s ? "bg-primary/15 text-primary" : "text-muted-foreground"
            }`}
          >
            {s}x
          </button>
        ))}
        <select
          value={camera}
          onChange={(e) => setCamera(e.target.value as CameraMode)}
          className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs"
          aria-label="Câmera"
        >
          {CAMERAS.map(([m, label]) => (
            <option key={m} value={m}>
              {label}
            </option>
          ))}
        </select>
        {canExportVideo() ? (
          <button
            type="button"
            onClick={() => void exportVideo()}
            className="rounded-lg border border-border/60 px-3 py-1.5 font-display text-xs uppercase tracking-wider"
          >
            {recording ? "Encerrar e baixar" : "Gravar vídeo"}
          </button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {Math.floor(t / 60)}' de {Math.floor(dur / 60)}'
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.round(dur)}
        value={Math.round(t)}
        onChange={(e) => {
          sim.seek(Number(e.target.value));
          setT(sim.time);
        }}
        aria-label="Linha do tempo"
        className="mt-2 w-full"
      />
    </section>
  );
}
