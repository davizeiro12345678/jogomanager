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
import { MatchSim } from "@/game/sim";
import { useT } from "@/i18n";

export const Route = createFileRoute("/partida-rapida")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Partida rápida contra o computador · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Escolha seu time, um adversário e jogue uma partida avulsa em 3D com narração e placar ao vivo.",
      },
      { property: "og:title", content: "Partida rápida · Pro Football Manager 3D" },
      { property: "og:description", content: "Um jogo avulso contra o computador, em 3D." },
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

        <div className="mt-6 flex flex-wrap gap-2">
          {LEAGUES.slice(0, 40).map((l) => (
            <button
              key={l.id}
              onClick={() => chooseLeague(l.id)}
              className={`rounded-lg border px-3 py-2 font-display text-xs uppercase tracking-wide transition ${
                l.id === leagueId
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Flag league={l.id} size={16} /> {l.name}
            </button>
          ))}
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
                    : "border-border bg-card/60 text-muted-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={randomize}
            className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
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
    <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <h2 className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <Crest club={CLUBS[value]!} size={44} detail="full" />
        <span className="font-display text-lg">{CLUBS[value]!.name}</span>
      </div>
      <div className="mt-3 grid max-h-56 gap-1 overflow-y-auto pr-1">
        {clubs.map((id) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            disabled={id === disabled}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
              id === value ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/40"
            } disabled:opacity-30`}
          >
            <Crest club={CLUBS[id]!} size={20} detail="simple" />
            {CLUBS[id]!.name}
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

function snapshot(sim: MatchSim): Snap {
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
  const sim = useMemo(() => {
    const ai = aiTactics(difficulty);
    return new MatchSim(
      buildTeamSetup(myId),
      buildTeamSetup(oppId, "4-4-2", ai.mentality, ai.pressing),
      seed,
    );
  }, [myId, oppId, difficulty, seed]);

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
  const [done, setDone] = useState(false);
  const [snap, setSnap] = useState<Snap>(() => snapshot(sim));

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const narratorRef = useRef<Narrator | null>(null);
  const cursorRef = useRef(0);

  useEffect(() => {
    const n = new Narrator({ lang, enabled: narrating });
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
      if (e.side === "neutral") continue;
      if (!["goal", "save", "shot", "foul", "kickoff", "halftime", "fulltime"].includes(e.type)) continue;
      n.speak(e.type as NarrationEvent, e.side === "home" ? sim.home.short : sim.away.short);
    }
  }, [snap, sim]);

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
    let guard = 0;
    while (!sim.finished && guard++ < 200_000) sim.step(0.4);
    setSnap(snapshot(sim));
    setDone(true);
  }, [sim]);

  const home = CLUBS[myId]!;
  const away = CLUBS[oppId]!;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070b12]">
      <Stadium3D sim={sim} mode={camera} quality={quality} />
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
          onClick={() => setCamera((c) => (c === "broadcast" ? "tactical" : c === "tactical" ? "fan" : "broadcast"))}
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
