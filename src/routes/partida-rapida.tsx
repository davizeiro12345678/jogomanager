import { createFileRoute, Link } from "@tanstack/react-router";
import { Pause, Play, Shuffle, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { Flag } from "@/components/game/Flag";
import { MatchReport } from "@/components/game/MatchReport";
import { Stadium3D, type CameraMode, type Quality } from "@/components/game/Stadium3D";
import { CLUBS, LEAGUES, getLeague } from "@/game/data/leagues";
import { detectQuality } from "@/game/device";
import { Narrator, type NarrationEvent } from "@/game/narrator";
import { aiTactics, buildTeamSetup, type Difficulty } from "@/game/quickMatch";
import { WorkerMatchView, type MatchRuntime } from "@/game/live-match";
import { createLiveMatchController, type LiveMatchController } from "@/game/simWorkerClient";
import { safeClub } from "@/game/squad";
import { useT } from "@/i18n";

export const Route = createFileRoute("/partida-rapida")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      {
        title:
          "Partida rápida contra o computador · Pro Football Manager 3D: Jogo de Futebol Manager Online",
      },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Partida rápida · Pro Football Manager 3D: Jogo de Futebol Manager Online",
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
  component: QuickMatchPage,
});

const DIFFS: { id: Difficulty; label: string }[] = [
  { id: "facil", label: "Fácil" },
  { id: "normal", label: "Normal" },
  { id: "dificil", label: "Difícil" },
];

function QuickMatchPage() {
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const league = getLeague(leagueId);
  const [myClub, setMyClub] = useState(league.clubs[0]!.id);
  const [oppClub, setOppClub] = useState(league.clubs[1]!.id);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(() => `quick-${Date.now()}`);

  function chooseLeague(id: string) {
    setLeagueId(id);
    const l = getLeague(id);
    setMyClub(l.clubs[0]!.id);
    setOppClub(l.clubs[1]!.id);
  }

  function randomize() {
    const l = LEAGUES[Math.floor(Math.random() * LEAGUES.length)]!;
    const a = l.clubs[Math.floor(Math.random() * l.clubs.length)]!;
    let b = l.clubs[Math.floor(Math.random() * l.clubs.length)]!;
    if (b.id === a.id) b = l.clubs[(l.clubs.indexOf(a) + 1) % l.clubs.length]!;
    setLeagueId(l.id);
    setMyClub(a.id);
    setOppClub(b.id);
  }

  if (started) {
    return (
      <QuickLive
        myId={myClub}
        oppId={oppClub}
        difficulty={difficulty}
        seed={seed}
        onExit={() => {
          setSeed(`quick-${Date.now()}`);
          setStarted(false);
        }}
      />
    );
  }

  return (
    <div className="pitch-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-4xl uppercase tracking-wide">Partida rápida</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha seu time e o adversário. O computador comanda o outro lado — sua carreira não é
          afetada.
        </p>

        {/* All leagues, grouped by country (was a 40-button wall that hid most leagues). */}
        <div className="mt-6 flex max-w-md items-center gap-3">
          <Flag league={league.id} country={league.country} size={24} />
          <label htmlFor="quick-league" className="sr-only">
            Liga
          </label>
          <select
            id="quick-league"
            value={leagueId}
            onChange={(e) => chooseLeague(e.target.value)}
            className="w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {Object.entries(
              LEAGUES.reduce<Record<string, typeof LEAGUES>>((acc, l) => {
                (acc[l.country] ??= []).push(l);
                return acc;
              }, {}),
            )
              .sort(([a], [b]) => (a === "Brasil" ? -1 : b === "Brasil" ? 1 : a.localeCompare(b, "pt-BR")))
              .map(([country, ls]) => (
                <optgroup key={country} label={country}>
                  {ls.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TeamPicker
            title="Seu time"
            clubs={league.clubs.map((c) => c.id)}
            value={myClub}
            onChange={setMyClub}
            disabled={oppClub}
          />
          <TeamPicker
            title="Adversário (computador)"
            clubs={league.clubs.map((c) => c.id)}
            value={oppClub}
            onChange={setOppClub}
            disabled={myClub}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {DIFFS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={`rounded-lg border px-3 py-2 font-display text-xs uppercase tracking-wide ${
                  difficulty === d.id
                    ? "border-primary bg-primary/15"
                    : "border-border surface-card text-muted-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={randomize}
            className="flex items-center gap-2 rounded-lg border border-border surface-card px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            <Shuffle size={14} /> Sortear confronto
          </button>
          <button
            onClick={() => setStarted(true)}
            disabled={myClub === oppClub}
            className="rounded-lg bg-primary px-5 py-2 font-display text-sm uppercase tracking-wide text-primary-foreground disabled:opacity-40"
          >
            Jogar
          </button>
          <Link to="/" className="text-xs text-muted-foreground underline">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function TeamPicker({
  title,
  clubs,
  value,
  onChange,
  disabled,
}: {
  title: string;
  clubs: string[];
  value: string;
  onChange: (id: string) => void;
  disabled: string;
}) {
  return (
    <section className="rounded-2xl border border-border/60 surface-card p-4">
      <h2 className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <Crest club={safeClub(value)} size={44} detail="full" />
        <span className="font-display text-lg">{safeClub(value).name}</span>
      </div>
      <div className="mt-3 grid max-h-56 gap-1 overflow-y-auto pr-1">
        {clubs.map((id) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            disabled={id === disabled}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
              id === value
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-muted/40"
            } disabled:opacity-30`}
          >
            <Crest club={safeClub(id)} size={20} detail="simple" />
            {safeClub(id).name}
          </button>
        ))}
      </div>
    </section>
  );
}

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

function QuickLive({
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

  const { lang } = useT();
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
  const [narrating, setNarrating] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [snap, setSnap] = useState<Snap>(() => snapshot(sim));
  const controllerRef = useRef<LiveMatchController | null>(null);

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const narratorRef = useRef<Narrator | null>(null);
  const cursorRef = useRef(0);

  useEffect(() => {
    const n = new Narrator({ lang, enabled: narrating, onCaption: setCaption });
    narratorRef.current = n;
    cursorRef.current = sim.events.length;
    return () => {
      n.dispose();
      narratorRef.current = null;
    };
  }, [sim, lang, narrating]);

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
          : (["goal", "save", "shot", "foul", "kickoff", "halftime", "fulltime"] as const).includes(
                e.type as never,
              )
            ? (e.type as NarrationEvent)
            : null;
      if (!ev) continue;
      const neutral = ev === "kickoff" || ev === "halftime" || ev === "fulltime";
      if (e.side === "neutral" && !neutral) continue;
      const goalDifference = Math.abs(snap.hg - snap.ag);
      const importance = snap.minute >= 80 && goalDifference <= 1 ? "decisive" : snap.minute >= 65 ? "pressure" : "routine";
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

  const skip = useCallback(() => {
    controllerRef.current?.skip();
  }, []);

  const home = safeClub(myId);
  const away = safeClub(oppId);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070b12]">
      <Stadium3D sim={sim} mode={camera} quality={quality} />
      {narrating && caption ? (
        <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-24 z-20 mx-auto max-w-2xl rounded-md bg-background/90 px-4 py-2 text-center text-sm font-medium text-foreground shadow-lg backdrop-blur md:bottom-20">
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

      <div className="pointer-events-none absolute bottom-24 left-3 z-10 hidden max-h-52 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/60 p-3 text-xs text-white/85 backdrop-blur-xl md:bottom-20 md:block">
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

      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-full border border-white/12 bg-black/70 p-1.5 backdrop-blur-xl">
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
          onClick={() => setNarrating((v) => !v)}
          aria-label={narrating ? "Desligar narração" : "Ligar narração"}
          className={`grid h-9 w-9 place-items-center rounded-full ${
            narrating ? "text-primary" : "text-white/60"
          }`}
        >
          {narrating ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button
          onClick={skip}
          aria-label="Pular para o fim"
          className="grid h-9 w-9 place-items-center rounded-full text-white/80"
        >
          <SkipForward size={16} />
        </button>
        <button
          onClick={() =>
            setCamera((c) =>
              c === "broadcast" ? "tactical" : c === "tactical" ? "fan" : "broadcast",
            )
          }
          className="rounded-full px-3 py-1.5 font-display text-xs uppercase tracking-wide text-white/80"
        >
          Câmera
        </button>
      </div>

      {done ? (
        <MatchReport sim={sim} homeId={myId} awayId={oppId} mySide="home" onFinish={onExit} />
      ) : null}
    </div>
  );
}
