import {
  ArrowLeft,
  List,
  Pause,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MatchLoading } from "@/components/game/MatchLoading";
import { MatchReport } from "@/components/game/MatchReport";
import { MatchScoreLine } from "@/features/match/MatchScoreLine";
import { Stadium3D, type CameraMode, type Quality } from "@/components/game/Stadium3D";
import { detectQuality } from "@/game/device";
import type { NarrationEvent } from "@/game/narrator";
import { useMatchNarration } from "@/hooks/useMatchNarration";
import { NarrationSettings } from "@/components/accessibility/NarrationSettings";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { aiTactics, buildTeamSetup, type Difficulty } from "@/game/quickMatch";
import { WorkerMatchView, type MatchRuntime } from "@/game/live-match";
import { createLiveMatchController, type LiveMatchController } from "@/game/simWorkerClient";
import { safeClub } from "@/game/squad";
import { CAMERA_OPTIONS } from "@/game/camera-modes";
import { useT } from "@/i18n/provider";
import "./career-interface.css";

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
      // Activate v2 only for newly started CPU quick-match opponents.
      // Old replay/career simulations remain on the historical ruleset.
      away: buildTeamSetup(oppId, "4-4-2", ai.mentality, ai.pressing, { tacticalAiRevision: 2 }),
      seed,
      rulesRevision: 2 as const,
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
  const [showTools, setShowTools] = useState(false);
  const toolsTrigger = useRef<HTMLButtonElement>(null);
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
  }, [snap, sim, narratorRef]);

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
      if (event.defaultPrevented || target?.closest('[role="dialog"]')) return;
      if (event.key === "Escape") {
        setShowEvents(false);
        setShowTools(false);
        setPaused(true);
        toolsTrigger.current?.focus();
        return;
      }
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
    <div className="match-interface quick-match">
      <div className="match-quick-stage">
        <Suspense fallback={<MatchLoading />}>
          <Stadium3D
            sim={sim}
            mode={camera}
            quality={quality}
            paused={paused || done}
            measurementKey={`quick:r${setups.rulesRevision ?? 1}:${setups.seed}:${setups.home.clubId}:${setups.away.clubId}`}
          />
        </Suspense>
      </div>
      <button
        type="button"
        onClick={() => {
          setPaused(true);
          onExit();
        }}
        aria-label={t("match.back")}
        className="match-quick-back"
      >
        <ArrowLeft size={18} />
      </button>
      <p role="status" className="sr-only">
        {paused ? t("match.paused") : ""}
      </p>
      <h1 className="sr-only">
        Partida rápida: {home.name} x {away.name}
      </h1>

      <div className="match-quick-score-wrap">
        <div
          className="match-scoreboard match-scoreboard-quick"
          aria-label={`${home.short} ${snap.hg}, ${away.short} ${snap.ag}, ${t("match.minute")} ${snap.minute}`}
        >
          <MatchScoreLine
            home={home}
            away={away}
            homeGoals={snap.hg}
            awayGoals={snap.ag}
            clock={`${paused ? "Ⅱ " : ""}${snap.minute}'`}
          />
          <div aria-hidden="true" className="match-quick-possession">
            <div
              className="transition-[width] duration-500"
              style={{ width: `${snap.poss[0]}%`, backgroundColor: home.primary }}
            />
            <div className="flex-1" style={{ backgroundColor: away.primary }} />
          </div>
          <div className="match-quick-statistics">
            <span>
              {t("match.possession")} {snap.poss[0]}%
            </span>
            <span>
              {t("match.shots")} {snap.hShots} – {snap.aShots}
            </span>
            <span>
              {t("match.possession")} {snap.poss[1]}%
            </span>
          </div>
        </div>
      </div>

      {showEvents ? (
        <div aria-label={t("match.events")} role="log" className="match-quick-feed">
          <div className="match-quick-tools-heading">
            <strong>{t("match.events")}</strong>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={() => {
                setShowEvents(false);
                toolsTrigger.current?.focus();
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
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

      <div aria-label={t("match.controls")} role="group" className="match-quick-transport">
        {caption && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="match-caption pointer-events-none absolute inset-x-0 bottom-full mb-3 mx-auto text-center"
          >
            {caption}
          </div>
        )}
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={t(paused ? "match.resume" : "match.pause")}
          aria-pressed={paused}
          className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          aria-label={t("match.speed")}
          className="match-quick-speed"
        >
          {[1, 2, 4, 8].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
        <select
          aria-label={t("match.camera")}
          title={CAMERA_OPTIONS.find((option) => option.id === camera)?.description}
          value={camera}
          onChange={(event) => setCamera(event.target.value as CameraMode)}
          className="match-quick-camera"
        >
          {CAMERA_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          ref={toolsTrigger}
          type="button"
          aria-label={t("match.moreControls")}
          title={t("match.moreControls")}
          aria-expanded={showTools}
          aria-controls="match-quick-tools"
          className="match-quick-more"
          onClick={() => {
            setShowTools((open) => !open);
            setShowEvents(false);
            setPaused(true);
          }}
        >
          <MoreHorizontal size={21} aria-hidden="true" />
        </button>
      </div>

      <div
        id="match-quick-tools"
        hidden={!showTools}
        className="match-quick-tools"
        role="group"
        aria-label={t("match.moreControls")}
      >
        <div className="match-quick-tools-heading">
          <strong>{t("match.moreControls")}</strong>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => {
              setShowTools(false);
              toolsTrigger.current?.focus();
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="match-quick-summary">
          {t("match.possession")} {snap.poss[0]}% / {snap.poss[1]}% · {t("match.shots")}{" "}
          {snap.hShots}–{snap.aShots}
        </p>
        <button
          type="button"
          className="match-tool-action"
          aria-pressed={showEvents}
          onClick={() => {
            setShowEvents((v) => !v);
            setShowTools(false);
          }}
        >
          <List size={18} aria-hidden="true" />
          {t("match.events")}
        </button>
        <button
          type="button"
          className="match-tool-action"
          aria-pressed={narrating}
          onClick={() => setNarrating((v) => !v)}
        >
          {narrating ? (
            <Volume2 size={18} aria-hidden="true" />
          ) : (
            <VolumeX size={18} aria-hidden="true" />
          )}
          {t(narrating ? "narration.off" : "narration.on")}
        </button>
        <NarrationSettings
          showLabel
          className="match-tool-action"
          onOpenChange={(open) => {
            if (open) setPaused(true);
          }}
        />
        <ShortcutsDialog
          quick
          showLabel
          className="match-tool-action"
          onOpenChange={(open) => {
            if (open) setPaused(true);
          }}
        />
        <button type="button" className="match-tool-action" onClick={skip}>
          <SkipForward size={18} aria-hidden="true" />
          {t("match.skip")}
        </button>
      </div>

      {done ? (
        <MatchReport sim={sim} homeId={myId} awayId={oppId} mySide="home" onFinish={onExit} />
      ) : null}
    </div>
  );
}
