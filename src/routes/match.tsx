import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Camera,
  ChevronDown,
  FastForward,
  Gauge,
  Pause,
  Play,
  Repeat,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Stadium3D, type CameraMode, type Quality } from "@/components/game/Stadium3D";
import { Crest } from "@/components/game/Crest";
import { MatchReport } from "@/components/game/MatchReport";
import { CLUBS } from "@/game/data/leagues";
import { MENTALITIES, PRESSING } from "@/game/formations";
import { MatchSim, type TeamSetup } from "@/game/sim";
import { advanceRound } from "@/game/career";
import { nextFixture } from "@/game/season";
import { buildSquad } from "@/game/squad";
import { pickLineup } from "@/game/career";
import { useCareer } from "@/hooks/useCareer";
import type { CareerState, Player } from "@/game/types";

export const Route = createFileRoute("/match")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Partida ao vivo em 3D · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Assista aos 90 minutos em 3D, troque de câmera e dê ordens táticas em tempo real da beira do campo.",
      },
      { property: "og:title", content: "Partida ao vivo em 3D · Pro Football Manager 3D" },
      { property: "og:description", content: "Ordens em tempo real enquanto a bola rola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
});

function buildOpponent(clubId: string): TeamSetup {
  const club = CLUBS[clubId]!;
  const squad = buildSquad(clubId);
  const { lineup } = pickLineup(squad, "4-3-3");
  const byId = Object.fromEntries(squad.map((p) => [p.id, p]));
  return {
    clubId,
    name: club.name,
    short: club.short,
    primary: club.primary,
    secondary: club.secondary,
    players: lineup.map((id) => byId[id]!).filter(Boolean) as Player[],
    tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
  };
}

function MatchPage() {
  const { career, update } = useCareer();
  const navigate = useNavigate();

  if (!career) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Nenhuma carreira ativa.
      </div>
    );
  }

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
  hg: number;
  ag: number;
  hShots: number;
  aShots: number;
  hOn: number;
  aOn: number;
  hFouls: number;
  aFouls: number;
  poss: [number, number];
  events: { type: string; text: string; minute: number }[];
  finished: boolean;
}

function snapshot(sim: MatchSim): Snap {
  const started = sim.stats.home.possessionTicks + sim.stats.away.possessionTicks > 30;
  const [ph, pa] = started ? sim.possessionPct() : ([50, 50] as [number, number]);
  return {
    minute: sim.minute(),
    hg: sim.stats.home.goals,
    ag: sim.stats.away.goals,
    hShots: sim.stats.home.shots,
    aShots: sim.stats.away.shots,
    hOn: sim.stats.home.onTarget,
    aOn: sim.stats.away.onTarget,
    hFouls: sim.stats.home.fouls,
    aFouls: sim.stats.away.fouls,
    poss: [ph, pa],
    events: sim.events.slice(-14).map((e) => ({ type: e.type, text: e.text, minute: e.minute })),
    finished: sim.finished,
  };
}

const CAMERAS = [
  ["broadcast", "TV"],
  ["tactical", "Tática"],
  ["goal", "Gol"],
  ["fan", "Torcida"],
  ["rail", "Trilho"],
  ["behind", "Replay"],
] as const;

function StatRow({ label, h, a }: { label: string; h: number; a: number }) {
  const total = Math.max(1, h + a);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-white/70">
        <span className="font-display tabular-nums text-white">{h}</span>
        <span className="uppercase tracking-widest">{label}</span>
        <span className="font-display tabular-nums text-white">{a}</span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-white/10">
        <div className="rounded-l-full bg-primary" style={{ width: `${(h / total) * 100}%` }} />
        <div className="flex-1 rounded-r-full bg-white/45" />
      </div>
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
  const home = CLUBS[homeId]!;
  const away = CLUBS[awayId]!;
  const [ph, pa] = snap.poss;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center px-3">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-black/70 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
          <Crest club={home} size={28} detail="simple" />
          <span className="font-display text-base tracking-wide text-white sm:text-lg">
            {home.short}
          </span>
          <span className="mx-auto font-display text-2xl tabular-nums text-white sm:text-3xl">
            {snap.hg} <span className="text-white/35">:</span> {snap.ag}
          </span>
          <span className="font-display text-base tracking-wide text-white sm:text-lg">
            {away.short}
          </span>
          <Crest club={away} size={28} detail="simple" />
          <span className="ml-1 rounded-md bg-primary px-2 py-0.5 font-display text-xs tabular-nums text-primary-foreground sm:text-sm">
            {paused ? "||" : `${snap.minute}'`}
          </span>
        </div>
        <div className="flex h-1.5 w-full">
          <div className="bg-primary transition-[width] duration-500" style={{ width: `${ph}%` }} />
          <div className="flex-1 bg-white/40" />
        </div>
        <div className="flex justify-between px-4 py-1 text-[10px] uppercase tracking-widest text-white/60">
          <span>Posse {ph}%</span>
          <span>
            Chutes {snap.hShots} – {snap.aShots}
          </span>
          <span>Posse {pa}%</span>
        </div>
      </div>
    </div>
  );
});

function eventIcon(type: string) {
  if (type === "goal") return "⚽";
  if (type === "save") return "🧤";
  if (type === "foul") return "🟨";
  if (type === "shot") return "🎯";
  if (type === "kickoff") return "🔔";
  return "•";
}

const Feed = memo(function Feed({ events }: { events: Snap["events"] }) {
  return (
    <div className="pointer-events-auto absolute bottom-24 left-3 z-10 hidden max-h-52 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/60 p-3 text-xs text-white/85 backdrop-blur-xl md:bottom-4 md:block">
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
  const myClub = CLUBS[career.clubId]!;
  const oppId = isHome ? fixture.away : fixture.home;

  const sim = useMemo(() => {
    const mySetup: TeamSetup = {
      clubId: myClub.id,
      name: myClub.name,
      short: myClub.short,
      primary: myClub.primary,
      secondary: myClub.secondary,
      players: career.lineup.map((id) => career.players[id]!).filter(Boolean),
      tactics: career.tactics,
    };
    const oppSetup = buildOpponent(oppId);
    return new MatchSim(
      isHome ? mySetup : oppSetup,
      isHome ? oppSetup : mySetup,
      `${career.clubId}-${career.round}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [career.round]);

  const mySide = isHome ? "home" : "away";
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [camera, setCamera] = useState<CameraMode>("broadcast");
  const [showStats, setShowStats] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [snap, setSnap] = useState<Snap>(() => snapshot(sim));
  const [quality, setQuality] = useState<Quality>(() => {
    if (typeof navigator === "undefined") return "media";
    const cores = navigator.hardwareConcurrency ?? 4;
    const mobile = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    if (mobile || cores <= 4) return "baixa";
    return cores >= 8 ? "alta" : "media";
  });

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Laço de simulação desacoplado do React: o HUD só atualiza ~10x por segundo,
  // então a árvore 3D (memoizada) nunca é reconciliada por quadro.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let acc = 0;
    let hidden = false;
    const onVis = () => {
      hidden = document.hidden;
      last = 0;
    };
    document.addEventListener("visibilitychange", onVis);

    function loop(t: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      if (pausedRef.current || hidden) return;
      const steps = Math.max(1, Math.round(speedRef.current));
      for (let i = 0; i < steps; i++) sim.step(dt * 6);
      acc += dt;
      if (acc >= 0.1 || sim.finished) {
        acc = 0;
        setSnap(snapshot(sim));
      }
      if (sim.finished) {
        setDone(true);
        cancelAnimationFrame(raf);
      }
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sim]);

  const skip = useCallback(() => {
    while (!sim.finished) sim.step(0.4);
    setSnap(snapshot(sim));
    setDone(true);
  }, [sim]);

  // Atalhos de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && /input|select|textarea/i.test(e.target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "1") setSpeed(1);
      else if (e.key === "2") setSpeed(2);
      else if (e.key === "3") setSpeed(4);
      else if (e.key === "4") setSpeed(8);
      else if (e.key.toLowerCase() === "c")
        setCamera((c) => {
          const i = CAMERAS.findIndex(([m]) => m === c);
          return CAMERAS[(i + 1) % CAMERAS.length]![0];
        });
      else if (e.key.toLowerCase() === "e") setShowStats((s) => !s);
      else if (e.key.toLowerCase() === "s") skip();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  function finish() {
    update(advanceRound(career, { hg: snap.hg, ag: snap.ag }));
    navigate({ to: "/club" });
  }

  function setMentality(v: number) {
    const setup = mySide === "home" ? sim.home : sim.away;
    setup.tactics = { ...setup.tactics, mentality: v };
    setSnap(snapshot(sim));
  }
  function setPressing(v: number) {
    const setup = mySide === "home" ? sim.home : sim.away;
    setup.tactics = { ...setup.tactics, pressing: v };
    setSnap(snapshot(sim));
  }

  const myTactics = (mySide === "home" ? sim.home : sim.away).tactics;

  // Substituições ao vivo (até 5)
  const [outPid, setOutPid] = useState("");
  const [inId, setInId] = useState("");
  const [subTick, setSubTick] = useState(0);
  const onPitch = useMemo(
    () => sim.players.filter((p) => p.side === mySide),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, mySide, subTick],
  );
  const usedIds = useMemo(
    () => new Set(sim.players.filter((p) => p.side === mySide).map((p) => p.pid)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, mySide, subTick],
  );
  const benchAvailable = career.bench
    .map((id) => career.players[id]!)
    .filter((p) => p && !usedIds.has(p.id) && p.injuryWeeks === 0 && !p.suspended);
  const subsUsed = sim.subsUsed[mySide];

  function makeSub() {
    const incoming = career.players[inId];
    if (!outPid || !incoming || subsUsed >= 5) return;
    if (sim.substitute(mySide, outPid, incoming)) {
      setOutPid("");
      setInId("");
      setSubTick((n) => n + 1);
      setSnap(snapshot(sim));
    }
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070b12]">
      <Stadium3D sim={sim} mode={camera} quality={quality} />

      <h1 className="sr-only">
        {CLUBS[fixture.home]!.name} x {CLUBS[fixture.away]!.name} — partida ao vivo em 3D
      </h1>

      <Scoreboard homeId={fixture.home} awayId={fixture.away} snap={snap} paused={paused} />
      <Feed events={snap.events} />

      {/* Estatísticas ao vivo */}
      {showStats ? (
        <div className="absolute right-3 top-24 z-10 w-60 space-y-3 rounded-2xl border border-white/10 bg-black/65 p-3 backdrop-blur-xl">
          <p className="font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
            Estatísticas
          </p>
          <StatRow label="Posse" h={snap.poss[0]} a={snap.poss[1]} />
          <StatRow label="Chutes" h={snap.hShots} a={snap.aShots} />
          <StatRow label="No gol" h={snap.hOn} a={snap.aOn} />
          <StatRow label="Faltas" h={snap.hFouls} a={snap.aFouls} />
        </div>
      ) : null}

      {/* Barra de transporte sempre visível */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/12 bg-black/70 p-1.5 backdrop-blur-xl md:hidden">
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Retomar partida" : "Pausar partida"}
          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        {[1, 2, 4, 8].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`h-9 w-9 rounded-full font-display text-xs ${
              speed === s ? "bg-white/25 text-white" : "text-white/70"
            }`}
          >
            {s}x
          </button>
        ))}
        <button
          onClick={skip}
          aria-label="Pular para o fim"
          className="grid h-9 w-9 place-items-center rounded-full text-white/80"
        >
          <SkipForward size={16} />
        </button>
        <button
          onClick={() => setPanelOpen((v) => !v)}
          aria-label="Abrir controles"
          className="grid h-9 w-9 place-items-center rounded-full text-white/80"
        >
          <ChevronDown size={16} className={panelOpen ? "" : "rotate-180"} />
        </button>
      </div>

      {/* Painel de controle */}
      <div
        className={`absolute bottom-16 right-3 z-20 w-[calc(100%-1.5rem)] max-w-xs space-y-3 rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur-xl transition-all duration-300 md:bottom-4 md:w-72 md:translate-y-0 md:opacity-100 ${
          panelOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0 md:pointer-events-auto"
        }`}
      >
        <div className="hidden items-center gap-1 md:flex">
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 font-display text-xs uppercase tracking-wider text-primary-foreground"
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? "Seguir" : "Pausar"}
          </button>
          {[1, 2, 4, 8].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`w-9 rounded-lg py-1.5 text-xs ${
                speed === s ? "bg-white/25 text-white" : "bg-white/10 text-white/70"
              }`}
            >
              {s}x
            </button>
          ))}
          <button
            onClick={skip}
            aria-label="Pular partida"
            className="grid w-9 place-items-center rounded-lg bg-white/10 py-1.5 text-white/80"
          >
            <FastForward size={14} />
          </button>
        </div>

        <div>
          <p className="flex items-center gap-1 font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
            <Camera size={11} /> Câmera
          </p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {CAMERAS.map(([m, label]) => (
              <button
                key={m}
                onClick={() => setCamera(m)}
                className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                  camera === m ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1 font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
            <Gauge size={11} /> Gráficos
          </p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {(["alta", "media", "baixa"] as const).map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`rounded-lg px-2 py-1 text-xs capitalize transition-colors ${
                  quality === q ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
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
              className="mt-1 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
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
              className="mt-1 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
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
              className="w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
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
              className="w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
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
          onClick={() => setShowStats((s) => !s)}
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white"
        >
          <Sparkles size={12} /> {showStats ? "Ocultar" : "Ver"} estatísticas
        </button>
        <p className="hidden text-[10px] leading-relaxed text-white/40 md:block">
          Espaço pausa · 1–4 velocidade · C câmera · E estatísticas · S pular
        </p>
      </div>

      {done ? (
        <MatchReport
          sim={sim}
          homeId={fixture.home}
          awayId={fixture.away}
          mySide={mySide}
          onFinish={finish}
        />
      ) : null}
    </div>
  );
}
