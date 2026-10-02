import { createFileRoute, Link } from "@tanstack/react-router";
import { Shuffle } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { Flag } from "@/components/game/Flag";
import { MatchLoading } from "@/components/game/MatchLoading";
import { LEAGUES, getLeague } from "@/game/data/leagues";
import type { Difficulty } from "@/game/quickMatch";
import { safeClub } from "@/game/squad";
import { canonical, noindexMeta, seoMeta } from "@/lib/seo";

const loadQuickLive = () => import("@/components/game/QuickLive");
const QuickLive = lazy(loadQuickLive);
const preloadQuickLive = () => {
  void loadQuickLive().catch(() => undefined);
};

export const Route = createFileRoute("/partida-rapida")({
  ssr: false,
  head: () => ({
    meta: [
      ...seoMeta({
        title: "Partida rápida em 3D · Pro Football Manager 3D",
        path: "/partida-rapida",
        description:
          "Escolha seu clube e o adversário, ajuste a dificuldade e acompanhe a partida em 3D com diferentes câmeras. Jogue contra o computador sem alterar sua carreira.",
      }),
      ...noindexMeta,
    ],
    links: canonical("/partida-rapida"),
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
      <Suspense fallback={<MatchLoading />}>
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
      </Suspense>
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
              .sort(([a], [b]) =>
                a === "Brasil" ? -1 : b === "Brasil" ? 1 : a.localeCompare(b, "pt-BR"),
              )
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
            onPointerEnter={preloadQuickLive}
            onFocus={preloadQuickLive}
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
