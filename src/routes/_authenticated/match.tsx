import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { Stadium3D, type CameraMode, type Quality } from "@/components/game/Stadium3D";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { MENTALITIES, PRESSING } from "@/game/formations";
import { MatchSim, type TeamSetup } from "@/game/sim";
import { advanceRound } from "@/game/career";
import { nextFixture } from "@/game/season";
import { buildSquad } from "@/game/squad";
import { pickLineup } from "@/game/career";
import { useCareer } from "@/hooks/useCareer";
import type { CareerState, Player } from "@/game/types";

export const Route = createFileRoute("/_authenticated/match")({
  head: () => ({
    meta: [
      { title: "Partida ao vivo em 3D · Manager 3D" },
      {
        name: "description",
        content:
          "Assista aos 90 minutos em 3D, troque de câmera e dê ordens táticas em tempo real da beira do campo.",
      },
      { property: "og:title", content: "Partida ao vivo em 3D · Manager 3D" },
      { property: "og:description", content: "Ordens em tempo real enquanto a bola rola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
});

function buildOpponent(clubId: string, career: CareerState): TeamSetup {
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
    const oppSetup = buildOpponent(oppId, career);
    return new MatchSim(
      isHome ? mySetup : oppSetup,
      isHome ? oppSetup : mySetup,
      `${career.clubId}-${career.round}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [career.round]);

  const mySide = isHome ? "home" : "away";
  const [speed, setSpeed] = useState(1);
  const [camera, setCamera] = useState<CameraMode>("broadcast");
  const [tick, setTick] = useState(0);
  const [done, setDone] = useState(false);
  const [quality, setQuality] = useState<Quality>(() =>
    typeof navigator !== "undefined" &&
    navigator.hardwareConcurrency &&
    navigator.hardwareConcurrency >= 8
      ? "alta"
      : "media",
  );

  const raf = useRef<number>(0);
  const last = useRef<number>(0);

  useEffect(() => {
    function loop(t: number) {
      const dt = Math.min(0.06, (t - (last.current || t)) / 1000);
      last.current = t;
      const steps = Math.max(1, Math.round(speed));
      for (let i = 0; i < steps; i++) sim.step(dt * 6);
      setTick((v) => v + 1);
      if (sim.finished) {
        setDone(true);
        return;
      }
      raf.current = requestAnimationFrame(loop);
    }
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [sim, speed]);

  function skip() {
    while (!sim.finished) sim.step(0.35);
    setDone(true);
    setTick((v) => v + 1);
  }

  function finish() {
    const hg = sim.stats.home.goals;
    const ag = sim.stats.away.goals;
    update(advanceRound(career, { hg, ag }));
    navigate({ to: "/club" });
  }

  function setMentality(v: number) {
    const setup = mySide === "home" ? sim.home : sim.away;
    setup.tactics = { ...setup.tactics, mentality: v };
    setTick((t) => t + 1);
  }
  function setPressing(v: number) {
    const setup = mySide === "home" ? sim.home : sim.away;
    setup.tactics = { ...setup.tactics, pressing: v };
    setTick((t) => t + 1);
  }

  const [ph, pa] = sim.possessionPct();
  const minute = sim.minute();

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#070b12]">
      <Stadium3D sim={sim} mode={camera} quality={quality} tick={tick} />

      {/* Placar */}
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/65 px-5 py-2.5 backdrop-blur-xl">
          <Crest club={CLUBS[fixture.home]!} size={30} />
          <span className="font-display text-xl tracking-wide text-white">
            {CLUBS[fixture.home]!.short}
          </span>
          <span className="font-display text-3xl text-white">
            {sim.stats.home.goals} <span className="text-white/40">:</span> {sim.stats.away.goals}
          </span>
          <span className="font-display text-xl tracking-wide text-white">
            {CLUBS[fixture.away]!.short}
          </span>
          <Crest club={CLUBS[fixture.away]!} size={30} />
          <span className="ml-3 rounded bg-primary px-2 py-0.5 font-display text-sm text-primary-foreground">
            {minute}'
          </span>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-xs text-white/70">
          <span>Posse {ph}% - {pa}%</span>
          <span>
            Chutes {sim.stats.home.shots} - {sim.stats.away.shots}
          </span>
        </div>
      </div>

      {/* Feed */}
      <div className="absolute bottom-4 left-4 max-h-56 w-72 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-white/85 backdrop-blur-xl">
        {[...sim.events]
          .slice(-12)
          .reverse()
          .map((e, i) => (
            <p key={i} className={e.type === "goal" ? "font-display text-sm text-primary" : "mb-1"}>
              {e.text}
            </p>
          ))}
      </div>

      {/* Controles */}
      <div className="absolute bottom-4 right-4 w-72 space-y-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-xl">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
            Câmera
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(
              [
                ["broadcast", "TV"],
                ["tactical", "Tática"],
                ["goal", "Gol"],
                ["fan", "Torcida"],
                ["behind", "Replay"],
              ] as const
            ).map(([m, label]) => (

              <button
                key={m}
                onClick={() => setCamera(m)}
                className={`flex-1 rounded px-2 py-1 text-xs ${
                  camera === m ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
            Gráficos
          </p>
          <div className="mt-1 flex gap-1">
            {(["alta", "media", "baixa"] as const).map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`flex-1 rounded px-2 py-1 text-xs capitalize ${
                  quality === q ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
            Velocidade
          </p>
          <div className="mt-1 flex gap-1">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`flex-1 rounded px-2 py-1 text-xs ${
                  speed === s ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"
                }`}
              >
                {s}x
              </button>
            ))}
            <button onClick={skip} className="flex-1 rounded bg-white/10 px-2 py-1 text-xs text-white">
              Pular
            </button>
          </div>
        </div>

        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
            Mentalidade
          </p>
          <select
            value={(mySide === "home" ? sim.home : sim.away).tactics.mentality}
            onChange={(e) => setMentality(Number(e.target.value))}
            className="mt-1 w-full rounded bg-white/10 px-2 py-1 text-xs text-white"
          >
            {MENTALITIES.map((m, i) => (
              <option key={m} value={i} className="text-black">
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
            Pressão
          </p>
          <select
            value={(mySide === "home" ? sim.home : sim.away).tactics.pressing}
            onChange={(e) => setPressing(Number(e.target.value))}
            className="mt-1 w-full rounded bg-white/10 px-2 py-1 text-xs text-white"
          >
            {PRESSING.map((m, i) => (
              <option key={m} value={i} className="text-black">
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {done ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur">
          <div className="w-80 rounded-2xl border border-white/10 bg-card p-6 text-center">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
              Fim de jogo
            </p>
            <p className="mt-2 font-display text-4xl">
              {CLUBS[fixture.home]!.short} {sim.stats.home.goals} x {sim.stats.away.goals}{" "}
              {CLUBS[fixture.away]!.short}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {sim.scorers.map((s, i) => (
                <li key={i}>
                  {s.minute}' {s.name}
                </li>
              ))}
            </ul>
            <button
              onClick={finish}
              className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 font-display text-sm uppercase tracking-widest text-primary-foreground"
            >
              Voltar à central
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
