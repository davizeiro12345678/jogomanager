import { createFileRoute, Link } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { computeTable, nextFixture } from "@/game/season";
import { useCareer } from "@/hooks/useCareer";

export const Route = createFileRoute("/_authenticated/club")({
  head: () => ({
    meta: [
      { title: "Central do clube · Manager 3D" },
      {
        name: "description",
        content: "Acompanhe elenco, tática, classificação e prepare a próxima partida do clube.",
      },
      { property: "og:title", content: "Central do clube · Manager 3D" },
      { property: "og:description", content: "O painel de comando do seu clube." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClubHub,
});

function ClubHub() {
  const { career, isLoading } = useCareer();

  if (isLoading) return <Loading />;
  if (!career) return <NoCareer />;

  const club = CLUBS[career.clubId]!;
  const fixture = nextFixture(career);
  const table = computeTable(career);
  const pos = table.findIndex((r) => r.clubId === career.clubId) + 1;
  const row = table[pos - 1];
  const opponentId = fixture
    ? fixture.home === career.clubId
      ? fixture.away
      : fixture.home
    : null;
  const opponent = opponentId ? CLUBS[opponentId] : undefined;

  return (
    <GameShell career={career}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="rounded-2xl border border-border/60 p-6 lg:col-span-2"
          style={{
            background: `linear-gradient(135deg, ${club.primary}33, transparent 60%)`,
          }}
        >
          <div className="flex items-center gap-4">
            <Crest club={club} size={64} />
            <div>
              <h1 className="font-display text-4xl uppercase leading-none tracking-wide">
                {club.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {pos}º lugar · {row?.pts ?? 0} pts · {row?.p ?? 0} jogos
              </p>
            </div>
          </div>

          {fixture && opponent ? (
            <div className="mt-6 rounded-xl border border-border/60 bg-card/70 p-4 backdrop-blur">
              <p className="font-display text-xs uppercase tracking-[0.25em] text-primary">
                Rodada {career.round} · {fixture.home === career.clubId ? "Em casa" : "Fora"}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Crest club={CLUBS[fixture.home]!} size={40} />
                <span className="font-display text-2xl">{CLUBS[fixture.home]!.short}</span>
                <span className="text-muted-foreground">x</span>
                <span className="font-display text-2xl">{CLUBS[fixture.away]!.short}</span>
                <Crest club={CLUBS[fixture.away]!} size={40} />
                <Link
                  to="/match"
                  className="ml-auto rounded-lg bg-primary px-5 py-2.5 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
                >
                  Jogar partida 3D
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-muted-foreground">Temporada concluída.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Últimos resultados</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {career.results
              .slice(-6)
              .reverse()
              .map((r) => (
                <li key={r.round} className="flex items-center justify-between">
                  <span className="text-muted-foreground">R{r.round}</span>
                  <span>
                    {CLUBS[r.home]?.short} {r.hg} x {r.ag} {CLUBS[r.away]?.short}
                  </span>
                </li>
              ))}
            {career.results.length === 0 ? (
              <li className="text-muted-foreground">Nenhuma partida disputada ainda.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </GameShell>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Carregando carreira...
    </div>
  );
}

function NoCareer() {
  return (
    <div className="pitch-bg flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl uppercase">Nenhuma carreira ativa</h1>
      <Link
        to="/new"
        className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
      >
        Escolher clube
      </Link>
    </div>
  );
}
