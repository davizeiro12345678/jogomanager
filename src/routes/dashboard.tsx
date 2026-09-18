import { createFileRoute, Link } from "@tanstack/react-router";

import { Crest } from "@/components/game/Crest";
import { GameShell } from "@/components/game/GameShell";
import {
  CountUp,
  FormPips,
  HudBar,
  HudCard,
  HudChip,
  HudRing,
  HudStat,
  SparkBars,
  Sparkline,
  toneFor,
} from "@/components/ui/hud";
import { CLUBS } from "@/game/data/leagues";
import { formatMoney, wageBill } from "@/game/economy";
import { formOf } from "@/game/events";
import { computeTable, nextFixture } from "@/game/season";
import { useCareer } from "@/hooks/useCareer";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Painel do treinador · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Painel do treinador · Pro Football Manager 3D: Jogo de Futebol Manager Online",
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
  component: Dashboard,
});

function Dashboard() {
  const { career } = useCareer();
  if (!career)
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="surface-card w-full max-w-md p-8 text-center">
          <h1 className="font-display text-2xl uppercase tracking-wide">Nenhuma carreira ativa</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha um clube, monte o elenco e comande a temporada inteira em 3D.
          </p>
          <Link
            to="/new"
            className="mt-6 inline-grid min-h-[44px] place-items-center rounded-xl bg-primary px-6 font-display text-sm uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.02] motion-reduce:transform-none"
          >
            Começar carreira
          </Link>
        </div>
      </div>
    );

  const club = CLUBS[career.clubId]!;
  const fixture = nextFixture(career);
  const atHome = fixture ? fixture.home === career.clubId : false;
  const opponentId = fixture ? (atHome ? fixture.away : fixture.home) : null;
  const opponent = opponentId ? CLUBS[opponentId] : undefined;

  const table = computeTable(career);
  const pos = table.findIndex((r) => r.clubId === career.clubId) + 1;
  const myRow = table.find((r) => r.clubId === career.clubId);
  const oppRow = opponentId ? table.find((r) => r.clubId === opponentId) : undefined;

  const players = Object.values(career.players);
  const morale = players.reduce((s, p) => s + p.morale, 0) / Math.max(1, players.length);
  const form = players.reduce((s, p) => s + formOf(p), 0) / Math.max(1, players.length);
  const injured = players.filter((p) => p.injuryWeeks > 0).length;
  const suspended = players.filter((p) => p.suspended).length;
  const unhappy = players.filter((p) => p.unhappy).length;

  // histórico do clube para os micrográficos
  const mine = career.results.filter((r) => r.home === career.clubId || r.away === career.clubId);
  const recent = mine.slice(-10).map((r) => {
    const home = r.home === career.clubId;
    return { gf: home ? r.hg : r.ag, ga: home ? r.ag : r.hg };
  });
  const last5 = recent.slice(-5).map(({ gf, ga }) => (gf > ga ? "V" : gf === ga ? "E" : "D"));
  const pointsSeries = recent.map(({ gf, ga }) => (gf > ga ? 3 : gf === ga ? 1 : 0));
  const goalsFor = recent.reduce((s, r) => s + r.gf, 0);
  const goalsAgainst = recent.reduce((s, r) => s + r.ga, 0);
  const wageWeek = wageBill(players);
  // folha anual em M€ comparada ao caixa disponível
  const wageYear = (wageWeek * 52) / 1000;
  const payrollShare = Math.min(
    100,
    (wageYear / Math.max(0.1, wageYear + Math.max(0, career.finances.budget))) * 100,
  );

  // tons por desempenho
  const formTone = toneFor(form);
  const moraleTone = toneFor(morale);
  const boardTone = toneFor(career.approval);
  const objectiveTone: "good" | "warn" | "bad" =
    pos > 0 && pos <= career.objective ? "good" : pos <= career.objective + 3 ? "warn" : "bad";
  const squadTone = injured + suspended >= 4 ? "bad" : injured + suspended >= 2 ? "warn" : "good";

  const topScorers = [...players]
    .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0) || b.ovr - a.ovr)
    .slice(0, 4);

  return (
    <GameShell career={career}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide sm:text-4xl">
            Painel do treinador
          </h1>
          <p className="hud-num mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {club.name} · Temporada {career.season} · Rodada {career.round}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <HudStat
            label="Posição"
            value={pos > 0 ? `${pos}º` : "—"}
            hint={`Objetivo ${career.objective}º`}
            tone={objectiveTone}
          />
          <HudStat
            label="Caixa"
            value={formatMoney(career.finances.budget)}
            hint={`Folha €${wageWeek.toLocaleString("pt-BR")}k/sem`}
          />
        </div>
      </div>

      <div className="mt-5 grid items-start gap-4 hud-stagger md:grid-cols-2 lg:grid-cols-3">
        {/* Próxima partida — cartão herói */}
        <HudCard
          title="Próxima partida"
          tone={fixture ? "good" : "neutral"}
          className="md:col-span-2"
          badge={
            fixture ? <HudChip>{atHome ? "Em casa" : "Fora"} · Rodada {fixture.round}</HudChip> : null
          }
        >
          {opponent && fixture ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <Crest club={club} size={56} />
                  <p className="truncate font-display text-sm uppercase">{club.name}</p>
                  <p className="hud-num text-[10px] text-muted-foreground">
                    {myRow ? `${myRow.pts} pts · ${pos}º` : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-display text-3xl italic text-muted-foreground">VS</p>
                  <p className="hud-num mt-1 text-[10px] uppercase text-muted-foreground">
                    {atHome ? "Mando seu" : "Mando do rival"}
                  </p>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <Crest club={opponent} size={56} />
                  <p className="truncate font-display text-sm uppercase">{opponent.name}</p>
                  <p className="hud-num text-[10px] text-muted-foreground">
                    {oppRow ? `${oppRow.pts} pts` : "—"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:w-48">
                <Link
                  to="/match"
                  className="grid min-h-[44px] place-items-center rounded-xl bg-primary px-4 font-display text-sm uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.02] motion-reduce:transform-none"
                >
                  Jogar agora
                </Link>
                <Link
                  to="/tactics"
                  className="grid min-h-[44px] place-items-center rounded-xl border border-border px-4 font-display text-sm uppercase tracking-wider transition-colors hover:border-primary/60"
                >
                  Ajustar tática
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Temporada encerrada.</p>
          )}
        </HudCard>

        {/* Forma recente */}
        <HudCard
          title="Forma recente"
          tone={formTone}
          badge={<Sparkline data={pointsSeries} width={72} height={22} />}
        >
          <FormPips results={last5} />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <HudStat label="Gols pró" value={<CountUp value={goalsFor} />} />
            <HudStat label="Gols contra" value={<CountUp value={goalsAgainst} />} />
            <HudStat
              label="Sequência"
              value={
                career.streak > 0 ? `${career.streak}V` : career.streak < 0 ? `${-career.streak}D` : "—"
              }
            />
          </div>
        </HudCard>

        {/* Finanças */}
        <HudCard
          title="Finanças"
          tone={career.finances.budget > 0 ? "good" : "bad"}
          action={
            <Link to="/finances" className="text-[10px] font-bold uppercase text-tone">
              Abrir
            </Link>
          }
        >
          <p className="hud-num text-3xl font-bold text-foreground">
            {formatMoney(career.finances.budget)}
          </p>
          <SparkBars className="mt-3" data={[3, 5, 4, 6, 5, 7, 6, 8]} />
          <div className="mt-3">
            <HudBar label="Peso da folha" value={payrollShare} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Patrocínio {formatMoney(career.sponsor)} · Folha €
            {wageWeek.toLocaleString("pt-BR")}k/sem
          </p>
        </HudCard>

        {/* Elenco */}
        <HudCard
          title="Elenco principal"
          tone={squadTone}
          className="md:col-span-2"
          action={
            <Link to="/squad" className="text-[10px] font-bold uppercase text-tone">
              Ver todos
            </Link>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <HudBar label="Moral média" value={morale} tone={moraleTone} />
              <HudBar label="Forma média" value={form} tone={formTone} />
              <div className="grid grid-cols-3 gap-2 pt-1">
                <HudStat label="Lesionados" value={injured} tone={injured ? "bad" : "good"} />
                <HudStat label="Suspensos" value={suspended} tone={suspended ? "warn" : "good"} />
                <HudStat label="Insatisfeitos" value={unhappy} tone={unhappy ? "warn" : "good"} />
              </div>
            </div>
            <ul className="space-y-2">
              {topScorers.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border border-border/60 bg-foreground/[0.03] p-2 ${
                    toneFor(formOf(p)) === "good"
                      ? "tone-good"
                      : toneFor(formOf(p)) === "warn"
                        ? "tone-warn"
                        : "tone-bad"
                  }`}
                >
                  <span className="hud-num grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-[10px] font-bold uppercase">
                    {p.pos}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{p.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="hud-bar flex-1">
                        <div className="hud-bar-fill" style={{ width: `${formOf(p)}%` }} />
                      </div>
                      <span className="hud-num text-[10px] font-bold text-tone">
                        {Math.round(formOf(p))}%
                      </span>
                    </div>
                  </div>
                  <span className="hud-num text-sm font-bold">{p.ovr}</span>
                </li>
              ))}
            </ul>
          </div>
        </HudCard>

        {/* Diretoria */}
        <HudCard
          title="Diretoria"
          tone={boardTone}
          action={
            <Link to="/board" className="text-[10px] font-bold uppercase text-tone">
              Sala
            </Link>
          }
        >
          <div className="flex items-center gap-4">
            <HudRing value={career.approval} label="Confiança" />
            <div className="min-w-0 flex-1 space-y-2">
              <HudBar label="Torcida" value={career.fanApproval} />
              <HudBar
                label="Pressão"
                value={career.pressure}
                tone={career.pressure > 60 ? "bad" : career.pressure > 35 ? "warn" : "good"}
              />
            </div>
          </div>
          <p className="mt-3 rounded-lg border-l-2 border-tone bg-foreground/[0.04] p-2 text-[11px] text-muted-foreground">
            Objetivo da temporada: terminar em {career.objective}º ou melhor — hoje você está em{" "}
            {pos > 0 ? `${pos}º` : "—"}.
          </p>
        </HudCard>

        {/* Notícias */}
        <HudCard
          title="Notícias"
          tone="neutral"
          action={
            <Link to="/news" className="text-[10px] font-bold uppercase text-tone">
              Tudo
            </Link>
          }
        >
          <ul className="space-y-3">
            {career.news.slice(0, 3).map((n) => (
              <li key={n.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <p className="text-xs font-semibold leading-snug">{n.title}</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{n.body}</p>
              </li>
            ))}
            {career.news.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhuma notícia ainda.</li>
            )}
          </ul>
        </HudCard>
      </div>
    </GameShell>
  );
}
