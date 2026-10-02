import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { NoCareer } from "@/components/game/screen-kit";
import { toast } from "sonner";
import {
  BarChart3,
  ChevronDown,
  FastForward,
  MessageCircle,
  Pause,
  Play,
  Repeat,
  ShoppingBag,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BroadcastCockpit } from "@/components/game/BroadcastCockpit";

import { Stadium3D, type CameraMode, type Quality } from "@/components/game/LazyStadium";
import { MatchLoading } from "@/components/game/MatchLoading";
import { MatchMinimap } from "@/components/game/MatchMinimap";
import { nextCameraMode } from "@/game/camera-modes";
import { FpsPanel } from "@/components/game/FpsPanel";
import { fpsMeter } from "@/game/fps-meter";
import { Cutscene } from "@/components/game/Cutscene";
import { useCinematicPreload } from "@/components/game/cinematic/cinematic-loading";
import { ceremonyEnabled } from "@/game/ceremony-prefs";
import { POSTMATCH_SCENE_IDS, PREMATCH_SCENE_IDS } from "@/content/cutscenes";
import { Crest } from "@/components/game/Crest";
import { MatchReport } from "@/components/game/MatchReport";
import { MENTALITIES, PRESSING } from "@/game/formations";
import { WorkerMatchView, type MatchRuntime } from "@/game/live-match";
import type { TeamSetup, TeamTalkKind } from "@/game/sim";
import { ReplayRecorder, saveReplay } from "@/game/replay";
import type { NarrationEvent } from "@/game/narrator";
import { useMatchNarration } from "@/hooks/useMatchNarration";
import { NarrationSettings } from "@/components/accessibility/NarrationSettings";
import {
  advanceRoundAsync,
  createLiveMatchController,
  type LiveMatchController,
} from "@/game/simWorkerClient";
import { achievementById } from "@/game/achievements";
import { detectQuality, detectQualityByGpu } from "@/game/device";
import {
  getBroadcastPreferences,
  setBroadcastPreferences,
  type QualityPref,
} from "@/game/visual-settings";

import { nextFixture } from "@/game/season";
import { safeClub } from "@/game/squad";
import { matchdaySupporters, worldFor } from "@/game/career-world";
import { buildTeamSetup } from "@/game/quickMatch";
import { useCareer } from "@/hooks/useCareer";
import { useT } from "@/i18n";
import type { CareerState, ManagerLook } from "@/game/types";

/** Aparência padrão do treinador nas cenas, quando a carreira não tem uma. */
const FALLBACK_LOOK: ManagerLook = {
  skin: 2,
  hair: 1,
  hairColor: "#2b1d14",
  beard: 0,
  outfit: 0,
};

const INTRO_KEY = "manager3d.prematchIntro";

const PrematchCeremony = lazy(() =>
  import("@/components/game/PrematchCeremony").then((module) => ({
    default: module.PrematchCeremony,
  })),
);
const StorePanel = lazy(() =>
  import("@/components/game/StorePanel").then((module) => ({ default: module.StorePanel })),
);
const ChatPanel = lazy(() =>
  import("@/components/game/ChatPanel").then((module) => ({ default: module.ChatPanel })),
);

function prematchIntroEnabled(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) !== "off";
  } catch {
    return true;
  }
}

function storePrematchIntro(on: boolean) {
  try {
    localStorage.setItem(INTRO_KEY, on ? "on" : "off");
  } catch {
    /* armazenamento indisponível: a preferência vale só para esta sessão */
  }
}

export const Route = createFileRoute("/match")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Partida ao vivo em 3D · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Partida ao vivo em 3D · Pro Football Manager 3D: Jogo de Futebol Manager Online",
      },
      {
        property: "og:description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
});

function buildOpponent(clubId: string): TeamSetup {
  // `buildTeamSetup` já usa clube seguro (nunca estoura com id fora do
  // catálogo) e entrega o elenco enriquecido com salário/valor/potencial.
  return buildTeamSetup(clubId, "4-3-3", 2, 1);
}

function MatchPage() {
  useCinematicPreload();
  const { career, update } = useCareer();
  const navigate = useNavigate();

  if (!career) return <NoCareer hint="Comece uma carreira para disputar os 90 minutos em 3D." />;

  const fixture = nextFixture(career);
  if (!fixture) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p>Temporada concluída.</p>
        <Link to="/league" className="text-primary underline">
          Ver tabela
        </Link>
      </div>
    );
  }

  return <LiveMatch career={career} update={update} navigate={navigate} />;
}

/** Instantâneo do estado do jogo enviado ao HUD (~10x por segundo). */
interface Snap {
  minute: number;
  clock: string;
  phase: string;
  hg: number;
  ag: number;
  hShots: number;
  aShots: number;
  hXg: number;
  aXg: number;
  hOn: number;
  aOn: number;
  hFouls: number;
  aFouls: number;
  hPass: number;
  aPass: number;
  hPassOk: number;
  aPassOk: number;
  hCorners: number;
  aCorners: number;
  hYellow: number;
  aYellow: number;
  hRed: number;
  aRed: number;
  poss: [number, number];
  events: { type: string; text: string; minute: number }[];
  finished: boolean;
}

function snapshot(sim: MatchRuntime): Snap {
  const started = sim.stats.home.possessionTicks + sim.stats.away.possessionTicks > 30;
  const [ph, pa] = started ? sim.possessionPct() : ([50, 50] as [number, number]);
  return {
    minute: sim.minute(),
    clock: sim.clock ?? `${sim.minute()}'`,
    phase: sim.phase ?? (sim.minute() <= 45 ? "first" : "second"),
    hg: sim.stats.home.goals,
    ag: sim.stats.away.goals,
    hShots: sim.stats.home.shots,
    aShots: sim.stats.away.shots,
    hXg: Math.round(sim.stats.home.xg * 100) / 100,
    aXg: Math.round(sim.stats.away.xg * 100) / 100,
    hOn: sim.stats.home.onTarget,
    aOn: sim.stats.away.onTarget,
    hFouls: sim.stats.home.fouls,
    aFouls: sim.stats.away.fouls,
    hPass: sim.stats.home.passes,
    aPass: sim.stats.away.passes,
    hPassOk: sim.stats.home.passesOk,
    aPassOk: sim.stats.away.passesOk,
    hCorners: sim.stats.home.corners,
    aCorners: sim.stats.away.corners,
    hYellow: sim.stats.home.yellow,
    aYellow: sim.stats.away.yellow,
    hRed: sim.stats.home.red,
    aRed: sim.stats.away.red,
    poss: [ph, pa],
    events: sim.events.slice(-14).map((e) => ({ type: e.type, text: e.text, minute: e.minute })),
    finished: sim.finished,
  };
}

const MATCH_SPEEDS = [1, 2, 4, 8] as const;

function nextMatchSpeed(current: number) {
  const index = MATCH_SPEEDS.indexOf(current as (typeof MATCH_SPEEDS)[number]);
  return MATCH_SPEEDS[(index + 1 + MATCH_SPEEDS.length) % MATCH_SPEEDS.length]!;
}

function StatRow({ label, h, a }: { label: string; h: number; a: number }) {
  const total = Math.max(1, h + a);
  const pct = (h / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-white/70">
        <span className="font-display tabular-nums text-white">{h}</span>
        <span className="uppercase tracking-widest">{label}</span>
        <span className="font-display tabular-nums text-white">{a}</span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="rounded-l-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
        <div className="flex-1 rounded-r-full bg-white/45" />
      </div>
    </div>
  );
}

/**
 * Pressão da partida: mede quem está criando mais nos últimos lances (chutes,
 * chutes no gol, escanteios) com esquecimento gradual, para o HUD mostrar de
 * quem é o jogo agora — e não o acumulado dos 90 minutos.
 */
function useMomentum(snap: Snap) {
  const prev = useRef({ hs: 0, as: 0, ho: 0, ao: 0, hc: 0, ac: 0 });
  const value = useRef(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const p = prev.current;
    const gain =
      (snap.hShots - p.hs) * 1 +
      (snap.hOn - p.ho) * 1.6 +
      (snap.hCorners - p.hc) * 0.8 -
      ((snap.aShots - p.as) * 1 + (snap.aOn - p.ao) * 1.6 + (snap.aCorners - p.ac) * 0.8);
    prev.current = {
      hs: snap.hShots,
      as: snap.aShots,
      ho: snap.hOn,
      ao: snap.aOn,
      hc: snap.hCorners,
      ac: snap.aCorners,
    };
    // decai devagar e soma o lance novo; fica preso entre -1 e 1
    const next = Math.max(-1, Math.min(1, value.current * 0.94 + gain * 0.35));
    value.current = next;
    setShown((v) => (Math.abs(v - next) > 0.02 ? next : v));
  }, [snap.hShots, snap.aShots, snap.hOn, snap.aOn, snap.hCorners, snap.aCorners]);

  return shown;
}

/** Linha do tempo com os marcos da partida (gols e cartões). */
function Timeline({ minute, events }: { minute: number; events: Snap["events"] }) {
  const marks = events.filter((e) => e.type === "goal" || e.type === "red");
  return (
    <div className="relative mx-4 mb-1 mt-1 h-1 rounded-full bg-white/12">
      <div
        className="h-full rounded-full bg-white/45 transition-[width] duration-700"
        style={{ width: `${Math.min(100, (minute / 90) * 100)}%` }}
      />
      <span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
      {marks.map((e, i) => (
        <span
          key={`${e.minute}-${i}`}
          title={e.text}
          className="absolute -top-[3px] h-[7px] w-[7px] -translate-x-1/2 rounded-full ring-1 ring-black/60"
          style={{
            left: `${Math.min(100, (e.minute / 90) * 100)}%`,
            background: e.type === "red" ? "#ef4444" : "#ffffff",
          }}
        />
      ))}
    </div>
  );
}

const Scoreboard = memo(function Scoreboard({
  homeId,
  awayId,
  snap,
  paused,
}: {
  homeId: string;
  awayId: string;
  snap: Snap;
  paused: boolean;
}) {
  const home = safeClub(homeId);
  const away = safeClub(awayId);
  const [ph, pa] = snap.poss;
  const momentum = useMomentum(snap);
  // pequeno destaque quando o placar muda
  const total = snap.hg + snap.ag;
  const [flash, setFlash] = useState(false);
  const lastTotal = useRef(total);
  useEffect(() => {
    if (total === lastTotal.current) return;
    lastTotal.current = total;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [total]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center px-3">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {`${home.name} ${snap.hg}, ${away.name} ${snap.ag}. ${paused ? "Partida pausada" : `${snap.minute} minutos`}.`}
      </p>
      <div
        className={`match-scoreboard w-full max-w-[22rem] overflow-hidden rounded-lg border bg-black/75 shadow-xl backdrop-blur-md transition-all duration-500 sm:max-w-sm ${
          flash ? "scale-[1.03] border-primary/70 shadow-primary/30" : "border-white/12"
        }`}
      >
        <div className="flex h-1 w-full">
          <div className="flex-1" style={{ background: home.primary }} />
          <div className="flex-1" style={{ background: away.primary }} />
        </div>
        <div className="flex items-center justify-between px-3 pt-1.5 font-display text-[9px] uppercase tracking-[0.22em] text-white/55">
          <span className="flex items-center gap-1.5">
            <i
              className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-amber-300" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.9)]"}`}
            />
            {paused ? "Pausado" : "Ao vivo"}
          </span>
          <span>
            {snap.phase === "first"
              ? "1º tempo"
              : snap.phase === "half"
                ? "Intervalo"
                : snap.phase === "second"
                  ? "2º tempo"
                  : snap.phase === "shootout"
                    ? "Pênaltis"
                    : snap.phase === "done"
                      ? "Fim"
                      : "Prorrogação"}
          </span>
        </div>
        <div className="flex min-h-11 items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3">
          <Crest club={home} size={24} detail="simple" />
          <span className="font-display text-sm tracking-wide text-white sm:text-base">
            {home.short}
          </span>
          <span
            className={`mx-auto font-display text-xl tabular-nums text-white transition-transform duration-300 sm:text-2xl ${
              flash ? "scale-125" : ""
            }`}
          >
            {snap.hg} <span className="text-white/35">:</span> {snap.ag}
          </span>
          <span className="font-display text-sm tracking-wide text-white sm:text-base">
            {away.short}
          </span>
          <Crest club={away} size={24} detail="simple" />
          <span className="ml-1 rounded-md bg-primary px-2 py-0.5 font-display text-xs tabular-nums text-primary-foreground sm:text-sm">
            {paused ? "||" : snap.clock}
          </span>
        </div>
        <div className="flex h-1.5 w-full">
          <div
            className="transition-[width] duration-700"
            style={{ width: `${ph}%`, background: home.primary }}
          />
          <div className="flex-1" style={{ background: away.primary }} />
        </div>
        <div className="hidden justify-between px-3 py-1 text-[10px] uppercase tracking-widest text-white/60 sm:flex">
          <span>Posse {ph}%</span>
          <span>
            Chutes {snap.hShots} – {snap.aShots}
          </span>
          <span>Posse {pa}%</span>
        </div>

        {/* pressão: de quem é o jogo neste momento */}
        <div className="hidden px-3 pb-1 sm:block">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
            <span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
            <div
              className="absolute inset-y-0 rounded-full transition-all duration-500"
              style={{
                left: momentum >= 0 ? "50%" : `${50 + momentum * 50}%`,
                width: `${Math.abs(momentum) * 50}%`,
                background: momentum >= 0 ? home.primary : away.primary,
              }}
            />
          </div>
          <p className="mt-0.5 text-center text-[9px] uppercase tracking-[0.25em] text-white/45">
            Pressão
          </p>
        </div>

        <div className="hidden sm:block">
          <Timeline minute={snap.minute} events={snap.events} />
        </div>
        <div className="hidden justify-between px-4 pb-1.5 text-[9px] uppercase tracking-widest text-white/35 sm:flex">
          <span>0&apos;</span>
          <span>45&apos;</span>
          <span>90&apos;</span>
        </div>
      </div>

      {/* faixa de gol: aparece por poucos segundos quando o placar muda */}
      {flash ? (
        <p
          aria-live="polite"
          className="cs-anim-rise mt-3 rounded-xl bg-primary px-6 py-1.5 font-display text-2xl uppercase tracking-[0.4em] text-primary-foreground shadow-2xl shadow-primary/40 sm:text-3xl"
        >
          Gol!
        </p>
      ) : null}
    </div>
  );
});

function eventIcon(type: string) {
  if (type === "goal") return "⚽";
  if (type === "save") return "🧤";
  if (type === "foul") return "🚫";
  if (type === "yellow") return "🟨";
  if (type === "red") return "🟥";
  if (type === "corner") return "🚩";
  if (type === "shot") return "🎯";
  if (type === "kickoff") return "🔔";
  if (type === "sub") return "🔁";
  if (type === "offside") return "⛔";
  if (type === "penalty") return "🥅";
  if (type === "freekick") return "🌀";
  if (type === "injury") return "🚑";
  if (type === "shootout") return "⚖️";
  if (type === "halftime") return "⏸️";
  if (type === "fulltime") return "🏁";
  if (type === "post") return "🥍";
  if (type === "talk") return "📢";
  if (type === "crowd") return "🔥";
  return "•";
}

const Feed = memo(function Feed({ events }: { events: Snap["events"] }) {
  return (
    <div
      aria-label="Eventos da partida"
      role="log"
      className="match-feed pointer-events-auto absolute bottom-24 left-3 z-10 hidden max-h-52 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/60 p-3 text-xs text-white/85 backdrop-blur-xl md:bottom-4 md:block"
    >
      {[...events].reverse().map((e, i) => (
        <p
          key={`${e.minute}-${i}-${e.text.slice(0, 8)}`}
          className={`mb-1 flex gap-2 ${e.type === "goal" ? "font-display text-sm text-primary" : ""}`}
        >
          <span className="w-8 shrink-0 tabular-nums text-white/45">{e.minute}'</span>
          <span className="shrink-0">{eventIcon(e.type)}</span>
          <span>{e.text}</span>
        </p>
      ))}
    </div>
  );
});

function LiveMatch({
  career,
  update,
  navigate,
}: {
  career: CareerState;
  update: (s: CareerState) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const fixture = nextFixture(career)!;
  const isHome = fixture.home === career.clubId;
  const supporters = useMemo(() => matchdaySupporters(career, isHome), [career, isHome]);
  const myClub = safeClub(career.clubId);
  const oppId = isHome ? fixture.away : fixture.home;

  const setups = useMemo(() => {
    const mySquad = Object.values(career.players);
    const mySetup: TeamSetup = {
      clubId: myClub.id,
      name: myClub.name,
      short: myClub.short,
      primary: myClub.primary,
      secondary: myClub.secondary,
      players: career.lineup.map((id) => career.players[id]!).filter(Boolean),
      tactics: career.tactics,
      bench: career.bench.map((id) => career.players[id]!).filter(Boolean),
      morale: Math.round(
        mySquad.reduce((s, p) => s + (p.morale ?? 70), 0) / Math.max(1, mySquad.length),
      ),
      cpu: false,
    };
    const oppSetup = buildOpponent(oppId);
    return {
      home: isHome ? mySetup : oppSetup,
      away: isHome ? oppSetup : mySetup,
      seed: `${career.clubId}-${career.round}`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [career.round]);
  const sim = useMemo(() => new WorkerMatchView(setups.home, setups.away), [setups]);

  const mySide = isHome ? "home" : "away";
  const { t } = useT();
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [camera, setCamera] = useState<CameraMode>(() => getBroadcastPreferences().camera);
  const [showStats, setShowStats] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelTrigger = useRef<HTMLButtonElement>(null);
  const panelClose = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!panelOpen) return;
    panelClose.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        (event.target instanceof HTMLElement && event.target.closest("[role='dialog']"))
      )
        return;
      setPanelOpen(false);
      panelTrigger.current?.focus();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [panelOpen]);
  /** gaveta lateral: loja ou chat sem sair da partida (o jogo pausa) */
  const [drawer, setDrawer] = useState<"none" | "store" | "chat">("none");
  const [done, setDone] = useState(false);
  const [postMatchStep, setPostMatchStep] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState(false);
  /** sequência imersiva (vestiário → camisas → túnel → apito) antes do pontapé */
  const [introStep, setIntroStep] = useState(() => (prematchIntroEnabled() ? 0 : -1));
  const introActive = introStep >= 0 && introStep < PREMATCH_SCENE_IDS.length;
  /** cerimônia 3D (entorno → túnel → hino → mosaico → sorteio) após as cutscenes */
  const [ceremony, setCeremony] = useState(() => ceremonyEnabled());
  const ceremonyActive = ceremony && !introActive;
  const narrCursorRef = useRef(0);
  const [snap, setSnap] = useState<Snap>(() => snapshot(sim));
  const [quality, setQuality] = useState<Quality>(() => detectQuality() as Quality);
  const controllerRef = useRef<LiveMatchController | null>(null);
  const qualityTouched = useRef(false);

  const chooseCamera = useCallback((next: CameraMode) => {
    setCamera(next);
    setBroadcastPreferences({ camera: next, directorAuto: next === "director" });
  }, []);

  const chooseQuality = useCallback((preference: QualityPref) => {
    qualityTouched.current = preference !== "auto";
    if (preference === "auto") {
      setQuality(detectQuality() as Quality);
      void detectQualityByGpu().then((next) => {
        if (!qualityTouched.current) setQuality(next as Quality);
      });
      return;
    }
    setQuality((preference === "cinema" ? "alta" : preference) as Quality);
  }, []);

  // Ajuste fino pela placa de vídeo real, logo depois do primeiro quadro.
  // Se o jogador já mexeu no nível gráfico, a escolha dele manda.
  useEffect(() => {
    let alive = true;
    void detectQualityByGpu().then((q) => {
      if (alive && !qualityTouched.current) setQuality(q as Quality);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Equilíbrio automático: mede os quadros reais do aparelho e desce (ou sobe)
   * um degrau de qualidade. Só age enquanto o jogador não escolher manualmente,
   * e espera alguns segundos entre trocas para não ficar oscilando.
   */
  useEffect(() => {
    let lastChange = 0;
    const off = fpsMeter.subscribe((s) => {
      if (qualityTouched.current) return;
      if (s.seconds < 6) return;
      const now = Date.now();
      if (now - lastChange < 12_000) return;
      setQuality((q) => {
        if ((s.avg < 34 || s.low1 < 22) && q !== "baixa") {
          lastChange = now;
          const next = q === "alta" ? "media" : "baixa";
          toast.info(`Gráficos em "${next}" para manter a partida fluida.`);
          return next;
        }
        if (s.avg > 58 && s.worst > 48 && q !== "alta") {
          lastChange = now;
          const next = q === "baixa" ? "media" : "alta";
          toast.info(`Sobra desempenho: gráficos em "${next}".`);
          return next;
        }
        return q;
      });
    });
    return off;
  }, []);

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  const [halfTalk, setHalfTalk] = useState<TeamTalkKind | null>(null);
  const [halfHeld, setHalfHeld] = useState(false);
  pausedRef.current = paused || introActive || ceremonyActive || halfHeld;
  const { narrating, setNarrating, caption, narratorRef } = useMatchNarration(
    sim,
    pausedRef.current,
  );

  // Narração: consome eventos novos do simulador e fala via Web Speech API.
  useEffect(() => {
    narrCursorRef.current = sim.events.length;
  }, [sim]);

  useEffect(() => {
    const n = narratorRef.current;
    if (!n) return;
    const fresh = sim.events.slice(narrCursorRef.current);
    narrCursorRef.current = sim.events.length;
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
      const team =
        e.side === "home" ? sim.home.short : e.side === "away" ? sim.away.short : sim.home.short;
      const player = e.text.match(/'\s+([^.!]+?)(?:\s+faz|\s+finaliza|\s+marca|!|\.)/)?.[1];
      const goalDifference = Math.abs(snap.hg - snap.ag);
      const importance =
        snap.minute >= 80 && goalDifference <= 1
          ? "decisive"
          : snap.minute >= 65 && goalDifference <= 2
            ? "pressure"
            : "routine";
      n.speak(ev, team, {
        minute: e.minute,
        homeGoals: snap.hg,
        awayGoals: snap.ag,
        importance,
        ...(player ? { player } : {}),
      });
    }
  }, [snap, sim]);

  const recorderRef = useRef<ReplayRecorder | null>(null);
  const savedRef = useRef(false);
  const storeReplay = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || savedRef.current) return;
    savedRef.current = true;
    void saveReplay(
      rec.build(
        `${sim.home.short} ${sim.stats.home.goals}-${sim.stats.away.goals} ${sim.away.short}`,
      ),
    );
  }, [sim]);

  useEffect(() => {
    recorderRef.current = new ReplayRecorder(sim);
    savedRef.current = false;
    const controller = createLiveMatchController({
      ...setups,
      view: sim,
      onSnapshot: (view) => {
        recorderRef.current?.sample();
        setSnap(snapshot(view));
      },
      onFinished: (view) => {
        setSnap(snapshot(view));
        setPostMatchStep(0);
      },
      onError: (message) => toast.warning(message),
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

  useEffect(
    () => controllerRef.current?.pause(paused || introActive || ceremonyActive || halfHeld),
    [paused, introActive, ceremonyActive, halfHeld],
  );

  // Intervalo: segura o jogo e abre o papo de vestiário (uma escolha por jogo).
  useEffect(() => {
    if (snap.phase === "half") {
      if (halfTalk === null) setHalfHeld(true);
    } else {
      setHalfHeld(false);
      setHalfTalk(null);
    }
  }, [snap.phase, halfTalk]);

  const chooseTalk = useCallback(
    async (kind: TeamTalkKind) => {
      setHalfTalk(kind);
      setHalfHeld(false);
      await controllerRef.current?.talk(mySide, kind);
      setSnap(snapshot(sim));
    },
    [mySide, sim],
  );
  useEffect(() => controllerRef.current?.setSpeed(speed), [speed]);
  useEffect(() => {
    if (done) storeReplay();
  }, [done, storeReplay]);

  const skip = useCallback(() => {
    controllerRef.current?.skip();
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest(
          "input, select, textarea, button, a, [role='dialog'], [contenteditable='true']",
        )
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "1") setSpeed(1);
      else if (e.key === "2") setSpeed(2);
      else if (e.key === "3") setSpeed(4);
      else if (e.key === "4") setSpeed(8);
      else if (e.key.toLowerCase() === "c") chooseCamera(nextCameraMode(camera));
      else if (e.key.toLowerCase() === "e") setShowStats((s) => !s);
      else if (e.key.toLowerCase() === "s") skip();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [camera, chooseCamera, skip]);

  function finish() {
    const perf = sim
      .playerRatings()
      .filter((r) => r.side === mySide)
      .map((r) => ({
        pid: r.pid,
        goals: r.goals,
        assists: r.assists,
        played: true,
        minutes: r.minutes,
        rating: r.rating,
        yellow: r.yellows,
        red: r.red,
        injuryWeeks: r.injuryWeeks,
      }));
    setAdvancing(true);
    void advanceRoundAsync(career, { hg: snap.hg, ag: snap.ag }, perf).then((next) => {
      const before = new Set(career.achievements ?? []);
      for (const id of next.achievements ?? []) {
        if (!before.has(id)) {
          const a = achievementById(id);
          if (a) toast.success(`Conquista desbloqueada: ${a.title}`);
        }
      }
      update(next);
      setAdvancing(false);
      navigate({ to: "/club" });
    });
  }

  function setMentality(v: number) {
    const setup = mySide === "home" ? sim.home : sim.away;
    const tactics = { ...setup.tactics, mentality: v };
    controllerRef.current?.setTactics(mySide, tactics);
    setSnap(snapshot(sim));
  }
  function setPressing(v: number) {
    const setup = mySide === "home" ? sim.home : sim.away;
    const tactics = { ...setup.tactics, pressing: v };
    controllerRef.current?.setTactics(mySide, tactics);
    setSnap(snapshot(sim));
  }

  const myTactics = (mySide === "home" ? sim.home : sim.away).tactics;

  // Substituições ao vivo (até 5)
  const [outPid, setOutPid] = useState("");
  const [inId, setInId] = useState("");
  // The worker populates and mutates this view after the first render. Derive
  // the roster from each snapshot so an initially empty team cannot stay cached.
  const onPitch = sim.players.filter((p) => p.side === mySide);
  const usedIds = new Set(onPitch.map((p) => p.pid));
  const benchAvailable = career.bench
    .map((id) => career.players[id]!)
    .filter((p) => p && !usedIds.has(p.id) && p.injuryWeeks === 0 && !p.suspended);
  const subsUsed = sim.subsUsed[mySide];

  async function makeSub() {
    const incoming = career.players[inId];
    if (!outPid || !incoming || subsUsed >= 5) return;
    if (await controllerRef.current?.substitute(mySide, outPid, incoming)) {
      setOutPid("");
      setInId("");
      setSnap(snapshot(sim));
    }
  }

  return (
    <div className="match-interface relative h-[100dvh] w-full overflow-hidden bg-[#070b12]">
      <Stadium3D
        sim={sim}
        mode={camera}
        quality={quality}
        supporters={supporters}
        paused={paused || introActive || ceremonyActive || halfHeld}
      />
      <div className="match-fps pointer-events-none absolute right-3 top-3 z-20">
        <FpsPanel quality={quality} detail={{ Câmera: camera, Velocidade: speed }} />
      </div>

      {narrating && caption ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="match-caption pointer-events-none absolute inset-x-3 bottom-36 z-20 mx-auto text-center md:bottom-24"
        >
          {caption}
        </div>
      ) : null}
      <div className="sr-only" aria-hidden="false">
        <h2>Atalhos de teclado</h2>
        <ul>
          <li>Espaço: Pausar/Retomar</li>
          <li>1, 2, 3, 4: Alterar velocidade</li>
          <li>C: Alternar câmeras</li>
          <li>E: Ver estatísticas</li>
          <li>M: Mostrar/ocultar radar</li>
          <li>S: Pular partida</li>
        </ul>
      </div>

      {/* Vestiário → camisas → túnel → apito: só começa o jogo ao fim (ou ao pular) */}
      {introActive ? (
        <>
          <Cutscene
            key={PREMATCH_SCENE_IDS[introStep]}
            scene={PREMATCH_SCENE_IDS[introStep]!}
            look={career.manager?.look ?? FALLBACK_LOOK}
            club={myClub}
            managerName={career.managerName}
            manner={worldFor(career).identity}
            trophies={career.trophies.length}
            narrate
            cinematic
            onDone={() => setIntroStep((s) => s + 1)}
            sequenceActions={
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIntroStep(PREMATCH_SCENE_IDS.length);
                    setCeremony(false);
                  }}
                  className="cutscene-control px-3 text-xs"
                >
                  Pular para o jogo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    storePrematchIntro(false);
                    setIntroStep(PREMATCH_SCENE_IDS.length);
                    setCeremony(false);
                  }}
                  className="cutscene-control px-3 text-xs"
                >
                  Não mostrar mais
                </button>
              </>
            }
          />
        </>
      ) : null}

      {/* cerimônia 3D: o jogo só rola depois dela (ou do pulo) */}
      {ceremonyActive ? (
        <Suspense fallback={<MatchLoading />}>
          <PrematchCeremony
            home={setups.home}
            away={setups.away}
            onDone={() => setCeremony(false)}
          />
        </Suspense>
      ) : null}

      <h1 className="sr-only">
        {safeClub(fixture.home).name} x {safeClub(fixture.away).name} — partida ao vivo em 3D
      </h1>

      <Scoreboard homeId={fixture.home} awayId={fixture.away} snap={snap} paused={paused} />
      <Feed events={snap.events} />
      <MatchMinimap view={sim} />

      {/* Estatísticas ao vivo — gaveta no celular, painel lateral no desktop */}
      {showStats ? (
        <div className="match-stats-panel pointer-events-auto absolute inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 max-h-[55vh] space-y-3 overflow-y-auto rounded-xl border border-primary/25 bg-[#07100d]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl md:inset-x-auto md:bottom-auto md:right-3 md:top-24 md:max-h-none md:w-64 md:rounded-xl md:p-3">
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/25 md:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
              Estatísticas
            </h2>
            <button
              onClick={() => setShowStats(false)}
              aria-label="Fechar estatísticas"
              className="min-h-11 rounded-full bg-white/10 px-4 text-xs text-white/70"
            >
              Fechar
            </button>
          </div>
          <StatRow label="Posse" h={snap.poss[0]} a={snap.poss[1]} />
          <StatRow label="Chutes" h={snap.hShots} a={snap.aShots} />
          <StatRow label="No gol" h={snap.hOn} a={snap.aOn} />
          <StatRow label="xG" h={snap.hXg} a={snap.aXg} />
          <StatRow label="Passes" h={snap.hPass} a={snap.aPass} />
          <StatRow label="Passes certos" h={snap.hPassOk} a={snap.aPassOk} />
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span className="font-display tabular-nums text-white">
              {snap.hPass ? Math.round((snap.hPassOk / snap.hPass) * 100) : 0}%
            </span>
            <span className="uppercase tracking-widest">Acerto de passe</span>
            <span className="font-display tabular-nums text-white">
              {snap.aPass ? Math.round((snap.aPassOk / snap.aPass) * 100) : 0}%
            </span>
          </div>
          <StatRow label="Escanteios" h={snap.hCorners} a={snap.aCorners} />
          <StatRow label="Faltas" h={snap.hFouls} a={snap.aFouls} />
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-[11px] text-white/70">
            <span className="font-display tabular-nums text-white">
              <span className="mr-1 inline-block h-2.5 w-2 rounded-[2px] bg-yellow-400 align-middle" />
              {snap.hYellow}
              <span className="ml-2 mr-1 inline-block h-2.5 w-2 rounded-[2px] bg-red-500 align-middle" />
              {snap.hRed}
            </span>
            <span className="uppercase tracking-widest">Cartões</span>
            <span className="font-display tabular-nums text-white">
              {snap.aYellow}
              <span className="mx-1 inline-block h-2.5 w-2 rounded-[2px] bg-yellow-400 align-middle" />
              {snap.aRed}
              <span className="ml-1 inline-block h-2.5 w-2 rounded-[2px] bg-red-500 align-middle" />
            </span>
          </div>
          {/* eventos ao vivo — no celular o feed lateral fica oculto */}
          <div className="md:hidden">
            <p className="mb-1 font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
              Lances
            </p>
            <div className="space-y-1 text-xs text-white/85">
              {[...snap.events]
                .reverse()
                .slice(0, 8)
                .map((e, i) => (
                  <p key={`${e.minute}-${i}`} className="flex gap-2">
                    <span className="w-7 shrink-0 tabular-nums text-white/45">{e.minute}'</span>
                    <span className="shrink-0">{eventIcon(e.type)}</span>
                    <span>{e.text}</span>
                  </p>
                ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Barra de transporte sempre visível */}
      <div
        role="toolbar"
        aria-label="Controles da partida"
        className="match-transport absolute z-20 items-center border border-white/12"
      >
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Retomar partida" : "Pausar partida"}
          title={paused ? "Retomar partida" : "Pausar partida"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-95 motion-reduce:transform-none"
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button
          onClick={() => setSpeed((current) => nextMatchSpeed(current))}
          aria-label={`Velocidade ${speed}x; ativar para alternar`}
          className="h-11 w-11 shrink-0 rounded-full font-display text-xs text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {speed}x
        </button>
        <button
          onClick={() => {
            setShowStats((s) => !s);
            setPanelOpen(false);
          }}
          aria-label="Ver estatísticas"
          title="Estatísticas ao vivo"
          aria-pressed={showStats}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${showStats ? "bg-white/25 text-white" : "text-white/70 hover:bg-white/10"}`}
        >
          <BarChart3 size={16} />
        </button>
        <BroadcastCockpit
          camera={camera}
          deviceQuality={quality}
          onCameraChange={chooseCamera}
          onQualityPreferenceChange={chooseQuality}
          className="match-camera-control"
        />
        <div className="match-transport-secondary">
          <button
            onClick={() => setNarrating((v) => !v)}
            aria-label={t(narrating ? "narration.off" : "narration.on")}
            aria-pressed={narrating}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${narrating ? "text-primary" : "text-white/60 hover:bg-white/10"}`}
          >
            {narrating ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <NarrationSettings
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/90"
            onOpenChange={(open) => {
              if (open) setPaused(true);
            }}
          />
          <button
            onClick={() => {
              setPaused(true);
              setDrawer("store");
            }}
            aria-label="Abrir loja"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ShoppingBag size={16} />
          </button>
          <button
            onClick={() => {
              setPaused(true);
              setDrawer("chat");
            }}
            aria-label="Abrir chat"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MessageCircle size={16} />
          </button>
          <button
            onClick={skip}
            aria-label="Pular para o fim"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <SkipForward size={16} />
          </button>
        </div>
        <button
          ref={panelTrigger}
          onClick={() => {
            setPanelOpen((v) => !v);
            setShowStats(false);
          }}
          aria-label={panelOpen ? "Fechar controles" : "Abrir controles"}
          title="Táticas e substituições"
          aria-controls="match-control-panel"
          aria-expanded={panelOpen}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown size={16} className={panelOpen ? "" : "rotate-180"} />
        </button>
      </div>

      {/* Loja e chat sem sair da partida */}
      <Sheet open={drawer !== "none"} onOpenChange={(o) => !o && setDrawer("none")}>
        <SheetContent
          side="right"
          className="flex w-full flex-col overflow-y-auto sm:max-w-md"
          closeLabel={drawer === "store" ? "Fechar loja" : "Fechar chat"}
        >
          <SheetHeader>
            <SheetTitle className="pr-10 font-display uppercase tracking-wide">
              {drawer === "store" ? "Loja" : "Chat global"}
            </SheetTitle>
            <SheetDescription>
              {drawer === "store"
                ? "Se precisar entrar, a loja abre em outra página e esta partida ao vivo não é salva. Com conta, o jogo fica pausado durante o checkout."
                : "Converse com outros técnicos sem perder o jogo."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <Suspense
              fallback={
                <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                  Carregando…
                </p>
              }
            >
              {drawer === "store" ? (
                <StorePanel next="/loja" columns={1} />
              ) : drawer === "chat" ? (
                <ChatPanel next="/match" />
              ) : null}
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>

      {/* Painel de controle */}
      <section
        id="match-control-panel"
        aria-label="Gestão da partida"
        hidden={!panelOpen}
        className="match-control-panel absolute z-20 space-y-3"
      >
        <div className="match-panel-heading">
          <h2>Gestão da partida</h2>
          <button
            type="button"
            ref={panelClose}
            aria-label="Fechar gestão da partida"
            onClick={() => {
              setPanelOpen(false);
              panelTrigger.current?.focus();
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 font-display text-xs uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 motion-reduce:transform-none"
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? "Seguir" : "Pausar"}
          </button>
          {MATCH_SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              aria-label={`Velocidade ${s}x`}
              aria-pressed={speed === s}
              className={`w-9 rounded-lg py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                speed === s
                  ? "bg-white/25 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {s}x
            </button>
          ))}

          <button
            onClick={() => setNarrating((v) => !v)}
            aria-label={t(narrating ? "narration.off" : "narration.on")}
            className={`grid w-9 place-items-center rounded-lg py-1.5 ${narrating ? "bg-primary/30 text-primary" : "bg-white/10 text-white/60"}`}
          >
            {narrating ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
          <button
            onClick={skip}
            aria-label="Pular partida"
            className="grid w-9 place-items-center rounded-lg bg-white/10 py-1.5 text-white/80"
          >
            <FastForward size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
              Mentalidade
            </span>
            <select
              aria-label="Mentalidade da equipe"
              value={myTactics.mentality}
              onChange={(e) => setMentality(Number(e.target.value))}
              className="mt-1 min-h-10 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
            >
              {MENTALITIES.map((m, i) => (
                <option key={m} value={i} className="text-black">
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
              Pressão
            </span>
            <select
              aria-label="Intensidade de pressão"
              value={myTactics.pressing}
              onChange={(e) => setPressing(Number(e.target.value))}
              className="mt-1 min-h-10 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
            >
              {PRESSING.map((m, i) => (
                <option key={m} value={i} className="text-black">
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p className="flex items-center justify-between font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
            <span className="flex items-center gap-1">
              <Repeat size={11} /> Substituições
            </span>
            <span>{subsUsed}/5</span>
          </p>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <select
              aria-label="Jogador que sai"
              value={outPid}
              onChange={(e) => setOutPid(e.target.value)}
              className="min-h-10 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
            >
              <option value="" className="text-black">
                Sai…
              </option>
              {onPitch.map((p) => (
                <option key={p.pid} value={p.pid} className="text-black">
                  {p.number} {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Jogador que entra"
              value={inId}
              onChange={(e) => setInId(e.target.value)}
              className="min-h-10 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
            >
              <option value="" className="text-black">
                Entra…
              </option>
              {benchAvailable.map((p) => (
                <option key={p.id} value={p.id} className="text-black">
                  {p.number} {p.name} ({p.pos})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={makeSub}
            disabled={!outPid || !inId || subsUsed >= 5}
            className="mt-1 w-full rounded-lg bg-white/15 px-2 py-1.5 text-xs text-white disabled:opacity-40"
          >
            Confirmar substituição
          </button>
        </div>

        <button
          onClick={() => {
            setShowStats((s) => !s);
            setPanelOpen(false);
          }}
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white"
        >
          <Sparkles size={12} /> {showStats ? "Ocultar" : "Ver"} estatísticas
        </button>
        <div className="match-panel-actions">
          <button
            type="button"
            onClick={() => {
              setPaused(true);
              setDrawer("store");
            }}
          >
            <ShoppingBag size={16} /> Loja
          </button>
          <button
            type="button"
            onClick={() => {
              setPaused(true);
              setDrawer("chat");
            }}
          >
            <MessageCircle size={16} /> Chat
          </button>
        </div>
        <p className="hidden text-[10px] leading-relaxed text-white/40 md:block">
          Espaço pausa · 1–4 velocidade · C câmera · E estatísticas · S pular
        </p>
      </section>

      {postMatchStep !== null && postMatchStep < POSTMATCH_SCENE_IDS.length ? (
        <Cutscene
          key={POSTMATCH_SCENE_IDS[postMatchStep]}
          scene={POSTMATCH_SCENE_IDS[postMatchStep]!}
          look={career.manager?.look ?? FALLBACK_LOOK}
          club={myClub}
          managerName={career.managerName}
          trophies={career.trophies.length}
          narrate
          cinematic
          onDone={() => {
            const next = postMatchStep + 1;
            if (next >= POSTMATCH_SCENE_IDS.length) {
              setPostMatchStep(null);
              setDone(true);
            } else setPostMatchStep(next);
          }}
        />
      ) : null}

      {snap.phase === "half" && halfTalk === null && !done ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Papo de intervalo"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1322] p-5 shadow-2xl">
            <p className="font-display text-[10px] uppercase tracking-[0.25em] text-amber-300/80">
              Intervalo · vestiário
            </p>
            <h2 className="mt-1 font-display text-xl text-white">
              O que você diz ao {(mySide === "home" ? sim.home : sim.away).short}?
            </h2>
            <p className="mt-1 text-xs text-white/55">
              {snap.hg}–{snap.ag} no placar. Uma escolha por jogo — o time volta diferente.
            </p>
            <div className="mt-4 grid gap-2">
              {(
                [
                  {
                    kind: "motivar",
                    icon: "🔥",
                    label: "Motivar",
                    desc: "+6 moral · +2 fôlego",
                    quote: '"É AGORA! Vamos virar isso juntos!"',
                  },
                  {
                    kind: "cobrar",
                    icon: "😠",
                    label: "Cobrar",
                    desc: "−2 moral · +6 fôlego",
                    quote: '"Quero mais entrega! Ninguém sai vaiado!"',
                  },
                  {
                    kind: "poupar",
                    icon: "🧊",
                    label: "Poupar",
                    desc: "+1 moral · +8 fôlego",
                    quote: '"Cabeça fria, pernas frescas. O jogo é longo."',
                  },
                ] as {
                  kind: TeamTalkKind;
                  icon: string;
                  label: string;
                  desc: string;
                  quote: string;
                }[]
              ).map((opt) => (
                <button
                  key={opt.kind}
                  onClick={() => void chooseTalk(opt.kind)}
                  className="group rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-amber-300/50 hover:bg-white/10"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      {opt.icon} {opt.label}
                    </span>
                    <span className="text-[11px] text-amber-200/80">{opt.desc}</span>
                  </span>
                  <span className="mt-0.5 block text-xs italic text-white/50">{opt.quote}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {done ? (
        <MatchReport
          sim={sim}
          homeId={fixture.home}
          awayId={fixture.away}
          mySide={mySide}
          onFinish={finish}
          advancing={advancing}
        />
      ) : null}
    </div>
  );
}
