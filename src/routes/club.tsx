import { gamePageHead } from "@/lib/game-page-metadata";
import { createFileRoute, Link } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { NoCareer as NoCareerScreen } from "@/components/game/screen-kit";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { formatMoney, formatWage, wageBill } from "@/game/economy";
import { computeTable, nextFixture } from "@/game/season";
import { useCareer } from "@/hooks/useCareer";
import type { TrainingFocus } from "@/game/types";
import { ClubHeritagePanel, ClubHonoursPanel } from "@/components/game/ClubHeritagePanel";

export const Route = createFileRoute("/club")({
  ssr: false,
  head: () => gamePageHead("/club"),
  component: ClubHub,
});

const TRAININGS: { key: TrainingFocus; label: string; desc: string }[] = [
  { key: "equilibrado", label: "Equilibrado", desc: "Recuperação e ritmo estáveis" },
  { key: "ataque", label: "Ataque", desc: "Evolui finalização dos jovens" },
  { key: "defesa", label: "Defesa", desc: "Evolui marcação dos jovens" },
  { key: "tecnica", label: "Técnica", desc: "Evolui passe dos jovens" },
  { key: "fisico", label: "Físico", desc: "Recupera condição mais rápido" },
];

function ClubHub() {
  const { career, isLoading, update } = useCareer();

  if (isLoading) return <Loading />;
  if (!career)
    return <NoCareerScreen hint="Escolha um clube para ver identidade, elenco e história." />;

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

  const players = Object.values(career.players);
  const injured = players.filter((p) => p.injuryWeeks > 0);
  const suspended = players.filter((p) => p.suspended);
  const bill = wageBill(players);

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
                {pos}º lugar · {row?.pts ?? 0} pts · {row?.p ?? 0} jogos · objetivo:{" "}
                {career.objective}º ou melhor
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Diretoria
              </p>
              <div className="mt-1 h-2 w-28 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full transition-all ${career.approval >= 55 ? "bg-primary" : career.approval >= 35 ? "bg-amber-400" : "bg-destructive"}`}
                  style={{ width: `${career.approval}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{career.approval}% de apoio</p>
            </div>
          </div>

          {fixture && opponent ? (
            <div className="mt-6 rounded-xl border border-border/60 surface-card p-4 backdrop-blur">
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

          {(injured.length > 0 || suspended.length > 0) && (
            <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-display uppercase tracking-wider text-destructive">Alertas</p>
              <ul className="mt-2 space-y-1">
                {injured.map((p) => (
                  <li key={p.id}>
                    🚑 {p.name} — lesionado ({p.injuryWeeks} rodada{p.injuryWeeks > 1 ? "s" : ""})
                  </li>
                ))}
                {suspended.map((p) => (
                  <li key={p.id}>🟨 {p.name} — suspenso na próxima rodada</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 surface-card p-5">
            <h2 className="font-display text-lg uppercase tracking-wide">Finanças</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Caixa</dt>
                <dd className="font-display text-primary">{formatMoney(career.finances.budget)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Folha semanal</dt>
                <dd>{formatWage(bill)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Receitas na temporada</dt>
                <dd className="text-primary">+{formatMoney(career.finances.income)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Gasto em contratações</dt>
                <dd className="text-destructive">-{formatMoney(career.finances.spent)}</dd>
              </div>
            </dl>
            <Link
              to="/transfers"
              className="mt-4 block rounded-lg bg-secondary px-4 py-2 text-center font-display text-xs uppercase tracking-widest transition hover:brightness-125"
            >
              Ir ao mercado
            </Link>
          </div>

          <div className="rounded-2xl border border-border/60 surface-card p-5">
            <h2 className="font-display text-lg uppercase tracking-wide">Treino da semana</h2>
            <label className="mt-2 block text-xs text-muted-foreground" htmlFor="training-select">
              Foco do treinamento
            </label>
            <select
              id="training-select"
              value={career.training}
              onChange={(e) => update({ ...career, training: e.target.value as TrainingFocus })}
              className="mt-1 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
            >
              {TRAININGS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              {TRAININGS.find((t) => t.key === career.training)?.desc}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 surface-card p-5">
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

        <div className="rounded-2xl border border-border/60 surface-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide">Notícias</h2>
            <Link to="/news" className="text-xs text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <ul className="mt-3 space-y-3 text-sm">
            {career.news.slice(0, 4).map((n) => (
              <li key={n.id} className="border-l-2 border-primary/50 pl-3">
                <p className="font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">
                  T{n.season} R{n.round} · {n.body}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <ClubHeritagePanel clubId={career.clubId} compact className="lg:col-span-2" />
        <ClubHonoursPanel clubId={career.clubId} />
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
