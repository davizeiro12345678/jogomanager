import { useCinematicPreload } from "@/components/game/cinematic/cinematic-loading";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Play, Users, Volume2, VolumeX } from "lucide-react";
import type { CareerState, Club } from "@/game/types";
import { Crest } from "@/components/game/Crest";
import { GameShell } from "@/components/game/GameShell";
import { RealClubInfo } from "@/components/game/RealClubInfo";
import { NoCareer } from "@/components/game/screen-kit";
import { CLUBS, getLeague } from "@/game/data/leagues";
import { computeTable, nextFixture } from "@/game/season";
import { useCareer } from "@/hooks/useCareer";
import "@/components/game/prematch.css";

export const Route = createFileRoute("/pre-jogo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pré-jogo — Football Manager 3D" },
      {
        name: "description",
        content: "Escalações, forma recente e narração antes do apito inicial.",
      },
      { property: "og:title", content: "Pré-jogo — Football Manager 3D" },
      { property: "og:description", content: "Prepare o confronto como numa transmissão de TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: PreMatchPage,
});

function PreMatchPage() {
  const { career } = useCareer();
  if (!career) return <NoCareer hint="Crie uma carreira para ver o pré-jogo." />;
  return <PreMatch career={career} />;
}

type FormLetter = "V" | "E" | "D";

function formFor(career: CareerState, clubId: string): FormLetter[] {
  return career.results
    .filter((r) => r.home === clubId || r.away === clubId)
    .slice(-5)
    .map((r) => {
      const gf = r.home === clubId ? r.hg : r.ag;
      const ga = r.home === clubId ? r.ag : r.hg;
      return gf > ga ? "V" : gf === ga ? "E" : "D";
    });
}

function PreMatch({ career }: { career: CareerState }) {
  // aquece o motor das cenas antes do clique em "Jogar"
  useCinematicPreload();
  const fixture = nextFixture(career);
  const league = getLeague(career.leagueId);
  const table = computeTable(career);
  const home = fixture ? CLUBS[fixture.home] : undefined;
  const away = fixture ? CLUBS[fixture.away] : undefined;

  if (!fixture || !home || !away) {
    return (
      <GameShell career={career}>
        <div className="prematch-empty">
          <h1>Temporada encerrada</h1>
          <Link to="/league" className="career-primary-button">
            Ver classificação
          </Link>
        </div>
      </GameShell>
    );
  }

  const lineup = career.lineup.map((id) => career.players[id]).filter((p) => p !== undefined);
  const star = [...lineup].sort((a, b) => b.ovr - a.ovr)[0];
  const posOf = (id: string) => table.findIndex((r) => r.clubId === id) + 1;

  return (
    <GameShell career={career}>
      <section className="prematch" aria-labelledby="prematch-title">
        <header className="prematch-hero">
          <p className="prematch-eyebrow">
            <span className="trainer-live-dot" /> {league.name} · Rodada {fixture.round}
          </p>
          <h1 id="prematch-title" className="sr-only">
            {home.name} contra {away.name}
          </h1>
          <div className="prematch-versus">
            <TeamBlock
              club={home}
              side="Mandante"
              pos={posOf(home.id)}
              form={formFor(career, home.id)}
            />
            <div className="prematch-vs" aria-hidden="true">
              VS
            </div>
            <TeamBlock
              club={away}
              side="Visitante"
              pos={posOf(away.id)}
              form={formFor(career, away.id)}
              delay
            />
          </div>
          <StrengthBar home={home} away={away} />
        </header>

        <Narration career={career} home={home} away={away} round={fixture.round} />

        <div className="my-4 grid gap-3 sm:grid-cols-2">
          <RealClubInfo name={home.name} />
          <RealClubInfo name={away.name} />
        </div>

        <div className="prematch-grid">
          <section className="prematch-card" aria-labelledby="lineup-title">
            <h2 id="lineup-title">
              <Users size={16} /> Seus titulares
            </h2>
            <ol className="prematch-lineup">
              {lineup.map((p) => {
                const bad = p.injuryWeeks > 0 || p.suspended;
                const tired = !bad && p.condition < 65;
                return (
                  <li key={p.id} className={bad ? "is-bad" : tired ? "is-tired" : undefined}>
                    <span className="prematch-num">{p.number}</span>
                    <span className="prematch-name">{p.name}</span>
                    <span className="prematch-pos">{p.pos}</span>
                    <span className="prematch-ovr">{p.ovr}</span>
                  </li>
                );
              })}
            </ol>
          </section>
          {star ? (
            <section className="prematch-card prematch-star" aria-labelledby="star-title">
              <h2 id="star-title">Craque do time</h2>
              <strong>{star.name}</strong>
              <p>
                {star.pos} · {star.age} anos · nível {star.ovr}
              </p>
              <p className="prematch-muted">{star.goals ?? 0} gols na temporada</p>
            </section>
          ) : null}
        </div>

        <div className="prematch-actions">
          <Link to="/tactics" className="career-secondary-button">
            <LayoutGrid size={16} /> Ajustar táticas
          </Link>
          <Link to="/squad" className="career-secondary-button">
            <Users size={16} /> Mudar escalação
          </Link>
          <Link to="/match" className="career-primary-button prematch-go">
            <Play size={18} /> Entrar em campo
          </Link>
        </div>
      </section>
    </GameShell>
  );
}

function TeamBlock({
  club,
  side,
  pos,
  form,
  delay,
}: {
  club: Club;
  side: string;
  pos: number;
  form: FormLetter[];
  delay?: boolean;
}) {
  return (
    <div className={`prematch-team${delay ? " is-delayed" : ""}`}>
      <Crest club={club} size={88} />
      <span className="prematch-side">{side}</span>
      <h2>{club.name}</h2>
      <p className="prematch-muted">{pos > 0 ? `${pos}º na tabela` : "Sem jogos"}</p>
      <div className="prematch-form" aria-label={`Últimos jogos: ${form.join(", ") || "nenhum"}`}>
        {form.length ? (
          form.map((f, i) => (
            <span key={i} data-r={f}>
              {f}
            </span>
          ))
        ) : (
          <span data-r="-">—</span>
        )}
      </div>
    </div>
  );
}

function StrengthBar({ home, away }: { home: Club; away: Club }) {
  const pct = Math.round((home.strength / Math.max(1, home.strength + away.strength)) * 100);
  return (
    <div
      className="prematch-strength"
      aria-label={`Força: ${home.strength} contra ${away.strength}`}
    >
      <span>{home.strength}</span>
      <div>
        <i style={{ width: `${pct}%` }} />
      </div>
      <span>{away.strength}</span>
    </div>
  );
}

function Narration({
  career,
  home,
  away,
  round,
}: {
  career: CareerState;
  home: Club;
  away: Club;
  round: number;
}) {
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState<"loading" | "playing" | "captions">("loading");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const caption = `Boa noite, torcedor! Rodada ${round}. De um lado, ${home.name}. Do outro, ${away.name}. Estádio cheio, clima de decisão. Vai começar!`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { narratePrematch } = await import("@/lib/tts.functions");
        const r = await narratePrematch({ data: { home: home.id, away: away.id, round } });
        if (cancelled) return;
        if (!r.ok) return setStatus("captions");
        const a = new Audio(r.audio);
        audioRef.current = a;
        await a.play();
        setStatus("playing");
      } catch {
        if (!cancelled) setStatus("captions");
      }
    })();
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, [home.id, away.id, round, career.clubId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  return (
    <div className="prematch-narration" role="status">
      <p>
        <strong>Narração:</strong> {caption}
      </p>
      <button
        type="button"
        className="career-secondary-button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Ligar som da narração" : "Tirar som da narração"}
        disabled={status !== "playing"}
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  );
}
