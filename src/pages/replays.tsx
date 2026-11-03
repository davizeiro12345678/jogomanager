import {
  EmptyState,
  ErrorPanel,
  PrimaryLink,
  ScreenHeader,
  SectionCard,
  SkeletonRows,
} from "@/components/game/screen-kit";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GameShell } from "@/components/game/GameShell";

import { Stadium3D, type CameraMode, type Quality } from "@/components/game/Stadium3D";

import { detectQuality } from "@/game/device";

import { deleteReplay, listReplays, ReplaySim, type Replay } from "@/game/replay";

import { useCareer } from "@/hooks/useCareer";
import { ScreenAwakeControl } from "@/components/game/ScreenAwakeControl";
import {
  canExportVideo,
  recordCanvas,
  downloadReplayVideo,
  replayVideoFile,
  shareReplayVideo,
  type CanvasRecording,
} from "@/lib/replay-video";

const CAMERAS: [CameraMode, string][] = [
  ["broadcast", "Transmissão"],
  ["goal", "Atrás do gol"],
  ["tactical", "Tática"],
  ["fan", "Torcida"],
  ["rail", "Rente ao campo"],
];

export function ReplaysPage() {
  const { career } = useCareer();
  const [list, setList] = useState<Replay[] | null>(null);
  const [current, setCurrent] = useState<Replay | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    setList(null);
    void listReplays()
      .then((replays) => {
        if (active) setList(replays);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteReplay(id);
    setList(await listReplays());
    setCurrent((c) => (c?.id === id ? null : c));
  }, []);

  const body = (
    <div className="space-y-4">
      <div>
        <ScreenHeader title="Galeria de replays" />
        <p className="text-sm text-muted-foreground">
          As últimas 20 partidas ficam guardadas no aparelho. Reveja em 3D, troque a câmera e
          exporte o vídeo.
        </p>
      </div>

      {current ? (
        <ReplayPlayer replay={current} onClose={() => setCurrent(null)} />
      ) : loadError ? (
        <ErrorPanel
          hint="Não foi possível abrir os replays salvos neste aparelho."
          onRetry={() => setRefresh((value) => value + 1)}
        />
      ) : list === null ? (
        <SkeletonRows />
      ) : list.length === 0 ? (
        <EmptyState
          title="Nenhum replay salvo"
          hint="Jogue uma partida e reveja seus lances aqui."
          action={<PrimaryLink to="/partida-rapida">Jogar partida rápida</PrimaryLink>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border/60 surface-card p-4">
              <p className="font-display text-lg uppercase tracking-wide">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()} · {Math.round(r.frames.length / 4)}s de
                jogo
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

  return career ? (
    <GameShell career={career}>{body}</GameShell>
  ) : (
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
  const [preparing, setPreparing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [video, setVideo] = useState<File | null>(null);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef<CanvasRecording | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recordingRef.current?.cancel();
      recordingRef.current = null;
    };
  }, []);

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
    setVideoMessage(null);
    if (recordingRef.current) {
      const capture = recordingRef.current;
      recordingRef.current = null;
      setRecording(false);
      setPreparing(true);
      try {
        const blob = await capture.stop();
        if (mounted.current) setVideo(replayVideoFile(blob, replay.title));
      } catch {
        if (mounted.current)
          setVideoMessage("Não foi possível concluir o vídeo. Tente uma nova gravação.");
      } finally {
        if (mounted.current) setPreparing(false);
      }
      return;
    }
    try {
      recordingRef.current = recordCanvas(canvas);
      setVideo(null);
      setRecording(true);
    } catch {
      setVideoMessage("A gravação não está disponível neste navegador.");
    }
  }, [replay.title]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setTimeout(() => void exportVideo(), 60_000);
    return () => window.clearTimeout(timer);
  }, [recording, exportVideo]);

  const shareVideo = async () => {
    if (!video || sharing) return;
    setSharing(true);
    const result = await shareReplayVideo(video);
    if (!mounted.current) return;
    setSharing(false);
    setVideoMessage(
      result === "unsupported" || result === "unavailable"
        ? "Compartilhamento indisponível. Use Baixar vídeo."
        : null,
    );
  };

  const dur = sim.duration || 1;

  return (
    <SectionCard className="rounded-2xl border border-border/60 surface-card p-4">
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
            disabled={preparing}
            className="rounded-lg border border-border/60 px-3 py-1.5 font-display text-xs uppercase tracking-wider"
          >
            {preparing ? "Preparando vídeo…" : recording ? "Encerrar gravação" : "Gravar vídeo"}
          </button>
        ) : null}
        <ScreenAwakeControl running={playing && !sim.finished} />
        <span className="ml-auto text-xs text-muted-foreground">
          {Math.floor(t / 60)}' de {Math.floor(dur / 60)}'
        </span>
      </div>
      {video ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadReplayVideo(video)}
            className="rounded-lg border border-border/60 px-3 py-2 text-xs"
          >
            Baixar vídeo
          </button>
          <button
            type="button"
            disabled={sharing}
            onClick={() => void shareVideo()}
            className="rounded-lg border border-border/60 px-3 py-2 text-xs"
          >
            {sharing ? "Compartilhando…" : "Compartilhar vídeo"}
          </button>
        </div>
      ) : null}
      {videoMessage ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {videoMessage}
        </p>
      ) : null}
      {recording ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Gravando um clipe de até 60 segundos.
        </p>
      ) : null}

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
    </SectionCard>
  );
}
