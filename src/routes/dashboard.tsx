import { createFileRoute, Link } from "@tanstack/react-router";

import { Crest } from "@/components/game/Crest";
import { GameShell } from "@/components/game/GameShell";
import { CLUBS } from "@/game/data/leagues";
import { formatMoney, wageBill } from "@/game/economy";
import { formOf } from "@/game/events";
import { computeTable, nextFixture } from "@/game/season";
import { useCareer } from "@/hooks/useCareer";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel do treinador · Manager 3D" },
      {
        name: "description",
        content:
          "Visão geral da temporada: próxima partida, forma recente, finanças, moral do elenco e pressão da diretoria.",
      },
      { property: "og:title", content: "Painel do treinador · Manager 3D" },
      { property: "og:description", content: "Seu centro de comando na carreira." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-4">
      <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-secondary">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function Dashboard() {
  const { career } = useCareer();
  if (!career)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Nenhuma carreira ativa.
      </div>
    );

  const club = CLUBS[career.clubId]!;
  const fixture = nextFixture(career);
  const opponentId = fixture
    ? fixture.home === career.clubId
      ? fixture.away
      : fixture.home
    : null;
  const opponent = opponentId ? CLUBS[opponentId] : undefined;
  const table = computeTable(career);
  const pos = table.findIndex((r) => r.clubId === career.clubId) + 1;
  const players = Object.values(career.players);
  const morale = players.reduce((s, p) => s + p.morale, 0) / Math.max(1, players.length);
  const form = players.reduce((s, p) => s + formOf(p), 0) / Math.max(1, players.length);
  const last5 = career.results.slice(-5).map((r) => {
    const home = r.home === career.clubId;
    const gf = home ? r.hg : r.ag;
    const ga = home ? r.ag : r.hg;
    return gf > ga ? "V" : gf === ga ? "E" : "D";
  });

  return (
    <GameShell career={career}>
      <h1 className="font-display text-3xl uppercase tracking-wide">Painel do treinador</h1>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Próxima partida">
          {opponent ? (
            <div className="flex items-center gap-3">
              <Crest club={opponent} size={44} />
              <div>
                <p className="font-medium">{opponent.name}</p>
                <p className="text-xs text-muted-foreground">
                  Rodada {fixture?.round} ·{" "}
                  {fixture?.home === career.clubId ? "Em casa" : "Fora de casa"}
                </p>
              </div>
              <Link
                to="/match"
                className="ml-auto rounded-lg bg-primary px-3 py-2 font-display text-sm uppercase text-primary-foreground"
              >
                Jogar
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Temporada encerrada.</p>
          )}
        </Card>

        <Card title="Forma recente">
          <div className="flex gap-1">
            {last5.length === 0 ? (
              <span className="text-sm text-muted-foreground">Sem jogos ainda.</span>
            ) : (
              last5.map((r, i) => (
                <span
                  key={i}
                  className={`grid h-8 w-8 place-items-center rounded-md font-display text-sm ${
                    r === "V"
                      ? "bg-primary/25 text-primary"
                      : r === "E"
                        ? "bg-secondary text-foreground"
                        : "bg-destructive/25 text-destructive"
                  }`}
                >
                  {r}
                </span>
              ))
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Sequência atual: {career.streak > 0 ? `${career.streak} vitória(s)` : career.streak < 0 ? `${-career.streak} derrota(s)` : "neutra"}
          </p>
        </Card>

        <Card title="Finanças">
          <p className="font-display text-2xl">{formatMoney(career.finances.budget)}</p>
          <p className="text-xs text-muted-foreground">
            Folha: €{wageBill(players).toLocaleString("pt-BR")}k/sem · Patrocínio:{" "}
            {formatMoney(career.sponsor)}
          </p>
          <Link to="/finances" className="mt-2 inline-block text-xs text-primary underline">
            Abrir finanças
          </Link>
        </Card>

        <Card title="Elenco">
          <Bar value={morale} label="Moral média" />
          <Bar value={form} label="Forma média" />
          <p className="mt-2 text-xs text-muted-foreground">
            {players.filter((p) => p.injuryWeeks > 0).length} lesionado(s) ·{" "}
            {players.filter((p) => p.suspended).length} suspenso(s) ·{" "}
            {players.filter((p) => p.unhappy).length} insatisfeito(s)
          </p>
        </Card>

        <Card title="Diretoria">
          <Bar value={career.approval} label="Aprovação da diretoria" />
          <Bar value={career.fanApproval} label="Aprovação da torcida" />
          <Bar value={career.pressure} label="Pressão" />
          <p className="mt-2 text-xs text-muted-foreground">
            {pos}º lugar · objetivo {career.objective}º
          </p>
          <Link to="/board" className="mt-1 inline-block text-xs text-primary underline">
            Sala da diretoria
          </Link>
        </Card>

        <Card title="Últimas notícias">
          <ul className="space-y-2 text-sm">
            {career.news.slice(0, 4).map((n) => (
              <li key={n.id}>
                <p className="font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {club.name} · Temporada {career.season}
      </p>
    </GameShell>
  );
}
