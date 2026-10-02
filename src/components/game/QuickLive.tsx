import { ArrowLeft, List, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crest } from "@/components/game/Crest";
import { MatchReport } from "@/components/game/MatchReport";
import { Stadium3D, type CameraMode, type Quality } from "@/components/game/Stadium3D";
import { detectQuality } from "@/game/device";
import type { NarrationEvent } from "@/game/narrator";
import { useMatchNarration } from "@/hooks/useMatchNarration";
import { NarrationSettings } from "@/components/accessibility/NarrationSettings";
import { aiTactics, buildTeamSetup, type Difficulty } from "@/game/quickMatch";
import { WorkerMatchView, type MatchRuntime } from "@/game/live-match";
import { createLiveMatchController, type LiveMatchController } from "@/game/simWorkerClient";
import { safeClub } from "@/game/squad";
import { CAMERA_OPTIONS } from "@/game/camera-modes";
import { useT } from "@/i18n";

interface Snap {
  minute: number;
  hg: number;
  ag: number;
  hShots: number;
  aShots: number;
  poss: [number, number];
  events: { type: string; text: string; minute: number }[];
  finished: boolean;
}

function snapshot(sim: MatchRuntime): Snap {
  const started = sim.stats.home.possessionTicks + sim.stats.away.possessionTicks > 30;
  const [ph, pa] = started ? sim.possessionPct() : ([50, 50] as [number, number]);
  return {
    minute: sim.minute(),
    hg: sim.stats.home.goals,
    ag: sim.stats.away.goals,
    hShots: sim.stats.home.shots,
    aShots: sim.stats.away.shots,
    poss: [ph, pa],
    events: sim.events.slice(-12).map((e) => ({ type: e.type, text: e.text, minute: e.minute })),
    finished: sim.finished,
  };
}

export default function QuickLive({
  myId,
  oppId,
  difficulty,
  seed,
  onExit,
}: {
  myId: string;
  oppId: string;
  difficulty: Difficulty;
  seed: string;
  onExit: () => void;
}) {
  const setups = useMemo(() => {
    const ai = aiTactics(difficulty);
    return {
      home: buildTeamSetup(myId),
      away: buildTeamSetup(oppId, "4-4-2", ai.mentality, ai.pressing),
      seed,
    };
  }, [myId, oppId, difficulty, seed]);
  const sim = useMemo(() => new WorkerMatchView(setups.home, setups.away), [setups]);

  const { t } = useT();
  const [quality] = useState<Quality>(() => {
    // `?q=baixa|media|alta` força o nível gráfico (testes, suporte e aparelhos fracos)
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q === "baixa" || q === "media" || q === "alta") return q;
    }
    return detectQuality() as Quality;
  });
  const [camera, setCamera] = useState<CameraMode>("broadcast");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const { narrating, setNarrating, caption, narratorRef } = useMatchNarration(sim, paused);
  const [showEvents, setShowEvents] = useState(false);
  const [snap, setSnap] = useState<Snap>(() => snapshot(sim));
  const controllerRef = useRef<LiveMatchController | null>(null);

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const cursorRef = useRef(0);

  useEffect(() => {
    cursorRef.current = sim.events.length;
  }, [sim]);

  useEffect(() => {
    const n = narratorRef.current;
    if (!n) return;
    const fresh = sim.events.slice(cursorRef.current);
    cursorRef.current = sim.events.length;
    for (const e of fresh) {
      const ev: NarrationEvent | null =
        e.type === "red"
          ? "redCard"
          : e.type === "yellow"
            ? "card"
            : (
                  [
                    "goal",
                    "save",
                    "shot",
                    "post",
                    "chance",
                    "foul",
                    "corner",
                    "sub",
                    "kickoff",
                    "halftime",
                    "fulltime",
                  ] as const
                ).includes(e.type as never)
              ? (e.type as NarrationEvent)
              : null;
      if (!ev) continue;
      const neutral = ev === "kickoff" || ev === "halftime" || ev === "fulltime";
      if (e.side === "neutral" && !neutral) continue;
      const goalDifference = Math.abs(snap.hg - snap.ag);
      const importance =
        snap.minute >= 80 && goalDifference <= 1
          ? "decisive"
          : snap.minute >= 65
            ? "pressure"
            : "routine";
      n.speak(ev, e.side === "away" ? sim.away.short : sim.home.short, {
        minute: e.minute,
        homeGoals: snap.hg,
        awayGoals: snap.ag,
        importance,
      });
    }
  }, [snap, sim]);

  useEffect(() => {
    const controller = createLiveMatchController({
      ...setups,
      view: sim,
      onSnapshot: (view) => setSnap(snapshot(view)),
      onFinished: (view) => {
        setSnap(snapshot(view));
        setDone(true);
      },
    });
    controllerRef.current = controller;
    const onVisibility = () => controller.pause(document.hidden || pausedRef.current);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      controller.dispose();
      controllerRef.current = null;
    };
  }, [setups, sim]);

  useEffect(() => controllerRef.current?.pause(paused), [paused]);
  useEffect(() => controllerRef.current?.setSpeed(speed), [speed]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input,select,textarea,button,[contenteditable=true]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        setPaused((p) => !p);
      }
      if (event.key.toLowerCase() === "c")
        setCamera(
          (mode) =>
            CAMERA_OPTIONS[
              (CAMERA_OPTIONS.findIndex((option) => option.id === mode) + 1) % CAMERA_OPTIONS.length
            ]!.id,
        );
      if (event.key.toLowerCase() === "n") setNarrating((v) => !v);
      if (["1", "2", "3", "4"].includes(event.key)) setSpeed([1, 2, 4, 8][Number(event.key) - 1]!);
      if (event.key === "Escape") {
        setShowEvents(false);
        setPaused(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setNarrating]);

  const skip = useCallback(() => {
    controllerRef.current?.skip();
  }, []);

  const home = safeClub(myId);
  const away = safeClub(oppId);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070b12]">
      <Stadium3D sim={sim} mode={camera} quality={quality} paused={paused || done} />
      <button
        type="button"
        onClick={() => {
          setPaused(true);
          onExit();
        }}
        aria-label={t("match.back")}
        className="absolute left-3 top-24 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/65 text-white/80 backdrop-blur md:top-3"
      >
        <ArrowLeft size={18} />
      </button>
      {paused ? (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center"
        >
          <span className="rounded-full border border-primary/30 bg-black/75 px-4 py-1.5 text-xs text-primary">
            {t("match.paused")}
          </span>
        </div>
      ) : null}
      {narrating && caption ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="match-caption pointer-events-none absolute inset-x-3 bottom-40 z-20 mx-auto text-center md:bottom-24"
        >
          {caption}
        </div>
      ) : null}
      <h1 className="sr-only">
        Partida rápida: {home.name} x {away.name}
      </h1>

      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-black/70 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 px-3 py-2">
            <Crest club={home} size={26} detail="simple" />
            <span className="font-display text-base text-white">{home.short}</span>
            <span className="mx-auto font-display text-2xl tabular-nums text-white">
              {snap.hg} <span className="text-white/35">:</span> {snap.ag}
            </span>
            <span className="font-display text-base text-white">{away.short}</span>
            <Crest club={away} size={26} detail="simple" />
            <span className="ml-1 rounded-md bg-primary px-2 py-0.5 font-display text-xs tabular-nums text-primary-foreground">
              {paused ? "||" : `${snap.minute}'`}
            </span>
          </div>
          <div className="flex h-1.5 w-full">
            <div
              className="bg-primary transition-[width] duration-500"
              style={{ width: `${snap.poss[0]}%` }}
            />
            <div className="flex-1 bg-white/40" />
          </div>
          <div className="flex justify-between px-4 py-1 text-[10px] uppercase tracking-widest text-white/60">
            <span>Posse {snap.poss[0]}%</span>
            <span>
              Chutes {snap.hShots} – {snap.aShots}
            </span>
            <span>Posse {snap.poss[1]}%</span>
          </div>
        </div>
      </div>

      {showEvents ? (
        <div
          aria-label={t("match.events")}
          className="absolute bottom-32 left-3 z-10 max-h-52 w-[min(18rem,calc(100%-1.5rem))] overflow-y-auto rounded-2xl border border-white/10 bg-black/75 p-3 text-xs text-white/85 backdrop-blur-xl md:bottom-20"
        >
          {snap.events.length === 0 ? (
            <p className="p-2 text-white/80">{t("match.eventsEmpty")}</p>
          ) : null}
          {[...snap.events].reverse().map((e, i) => (
            <p
              key={`${e.minute}-${i}`}
              className={`mb-1 flex gap-2 ${e.type === "goal" ? "font-display text-sm text-primary" : ""}`}
            >
              <span className="w-8 shrink-0 tabular-nums text-white/45">{e.minute}'</span>
              <span>{e.text}</span>
            </p>
          ))}
        </div>
      ) : null}

      <div
        aria-label={t("match.controls")}
        role="group"
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/12 bg-black/70 p-1.5 backdrop-blur-xl"
      >
        <button
          type="button"
          onClick={() => setShowEvents((v) => !v)}
          aria-label={t("match.events")}
          aria-pressed={showEvents}
          className={`grid h-11 w-11 place-items-center rounded-full ${showEvents ? "text-primary" : "text-white/65"}`}
        >
          <List size={17} />
        </button>
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={t(paused ? "match.resume" : "match.pause")}
          aria-pressed={paused}
          className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        {[1, 2, 4, 8].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            aria-label={`${t("match.speed")} ${s}×`}
            aria-pressed={speed === s}
            className={`h-11 w-11 rounded-full font-display text-xs ${
              speed === s ? "bg-white/25 text-white" : "text-white/70"
            }`}
          >
            {s}x
          </button>
        ))}
        <button
          onClick={() => setNarrating((v) => !v)}
          aria-label={t(narrating ? "narration.off" : "narration.on")}
          aria-pressed={narrating}
          className={`grid h-11 w-11 place-items-center rounded-full ${
            narrating ? "text-primary" : "text-white/60"
          }`}
        >
          {narrating ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <NarrationSettings
          className="grid h-11 w-11 place-items-center rounded-full text-white/90"
          onOpenChange={(open) => {
            if (open) setPaused(true);
          }}
        />
        <button
          onClick={skip}
          aria-label={t("match.skip")}
          className="grid h-11 w-11 place-items-center rounded-full text-white/80"
        >
          <SkipForward size={16} />
        </button>
        <select
          aria-label={t("match.camera")}
          title={CAMERA_OPTIONS.find((option) => option.id === camera)?.description}
          value={camera}
          onChange={(event) => setCamera(event.target.value as CameraMode)}
          className="h-11 max-w-40 rounded-lg border border-white/20 bg-[#101c19] px-3 text-sm text-white"
        >
          {CAMERA_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {done ? (
        <MatchReport sim={sim} homeId={myId} awayId={oppId} mySide="home" onFinish={onExit} />
      ) : null}
    </div>
  );
}
