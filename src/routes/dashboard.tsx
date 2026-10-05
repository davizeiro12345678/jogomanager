import { gamePageHead } from "@/lib/game-page-metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Coins,
  ClipboardList,
  Dumbbell,
  HeartPulse,
  LayoutGrid,
  Play,
  ShieldAlert,
  ArrowLeftRight,
  Trophy,
} from "lucide-react";
import type { CareerState } from "@/game/types";

import { Crest } from "@/components/game/Crest";
import { GameShell } from "@/components/game/GameShell";
import { NoCareer } from "@/components/game/screen-kit";
import {
  CountUp,
  FormPips,
  HudBar,
  HudCard,
  HudChip,
  HudRing,
  HudStat,
  Sparkline,
  toneFor,
} from "@/components/ui/hud";
import { CLUBS, getLeague } from "@/game/data/leagues";
import { FORMATIONS, MENTALITIES, PRESSING, TEMPOS, WIDTHS } from "@/game/formations";
import { formatMoney, wageBill } from "@/game/economy";
import { formOf } from "@/game/events";
import { drillDoneThisRound } from "@/game/training-drills";
import { computeTable, nextFixture } from "@/game/season";
import { useCareer } from "@/hooks/useCareer";
import { ClubHeritagePanel, ClubHonoursPanel } from "@/components/game/ClubHeritagePanel";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => gamePageHead("/dashboard"),
  component: Dashboard,
});

function Dashboard() {
  const { career } = useCareer();
  if (!career)
    return (
      <NoCareer hint="Escolha um clube, monte o elenco e comande a temporada inteira em 3D." />
    );

  return <TrainerDashboard key={`${career.clubId}:${career.season}`} career={career} />;
}

function TrainerDashboard({ career }: { career: CareerState }) {
  const club = CLUBS[career.clubId]!;
  const fixture = nextFixture(career);
  const atHome = fixture ? fixture.home === career.clubId : false;
  const opponentId = fixture ? (atHome ? fixture.away : fixture.home) : null;
  const opponent = opponentId ? CLUBS[opponentId] : undefined;

  const table = computeTable(career);
  const pos = table.findIndex((r) => r.clubId === career.clubId) + 1;
  const myRow = table.find((r) => r.clubId === career.clubId);

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

  // tons por desempenho
  const formTone = toneFor(form);
  const moraleTone = toneFor(morale);
  const boardTone = toneFor(career.approval);
  const squadTone = injured + suspended >= 4 ? "bad" : injured + suspended >= 2 ? "warn" : "good";

  const topScorers = [...players]
    .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0) || b.ovr - a.ovr)
    .slice(0, 4);

  const starters = career.lineup.map((id) => career.players[id]).filter((p) => p !== undefined);
  const unavailableStarters = starters.filter((p) => p.injuryWeeks > 0 || p.suspended);
  const availableStarters = starters.filter((p) => p.injuryWeeks === 0 && !p.suspended).length;
  const tiredStarters = starters.filter(
    (p) => p.condition < 65 && p.injuryWeeks === 0 && !p.suspended,
  );
  const league = getLeague(career.leagueId);
  const homeClub = atHome ? club : opponent;
  const awayClub = atHome ? opponent : club;
  const drillDone = Boolean(drillDoneThisRound(career));
  const onboardKey = `onboard-done:${career.clubId}:${career.season}`;
  const [onboardDone, setOnboardDone] = useState(() => {
    try {
      return localStorage.getItem(onboardKey) === "1";
    } catch {
      return false;
    }
  });
  const showOnboard = !onboardDone && career.round <= 4 && career.season <= 1;

  return (
    <GameShell career={career}>
      <div className="trainer-heading">
        <div className="trainer-heading-club">
          <Crest club={club} size={56} />
          <div>
          <p className="trainer-eyebrow">Sua central de decisões</p>
          <h1>Painel do treinador</h1>
          <p>
            {fixture
              ? `Prepare o ${club.name} para o próximo desafio.`
              : `Veja o balanço da temporada do ${club.name}.`}
          </p>
          </div>
        </div>
        <Link to="/league" className="trainer-league-link">
          <Trophy size={17} />
          <span>{league.name}</span>
          <ArrowRight size={15} />
        </Link>
      </div>

      <div className="trainer-match-grid">
        <section className="trainer-match-card" aria-labelledby="next-match-title">
          <div className="trainer-match-top">
            <h2 id="next-match-title">
              <CalendarDays size={17} />
              Próximo jogo
            </h2>
            <span>
              {fixture
                ? `Rodada ${fixture.round} · ${atHome ? "Em casa" : "Fora de casa"}`
                : "Balanço da temporada"}
            </span>
          </div>
          {fixture && homeClub && awayClub ? (
            <>
              <div className="trainer-match-teams">
                <div>
                  <Crest club={homeClub} size={68} />
                  <span>Mandante</span>
                  <h3>{homeClub.name}</h3>
                </div>
                <div className="trainer-match-vs">
                  <span>VS</span>
                  <small>{league.name}</small>
                </div>
                <div>
                  <Crest club={awayClub} size={68} />
                  <span>Visitante</span>
                  <h3>{awayClub.name}</h3>
                </div>
              </div>
              <div className="trainer-match-footer">
                <p>
                  <span className="trainer-live-dot" />
                  {unavailableStarters.length
                    ? `${unavailableStarters.length} titular(es) indisponível(is). Revise a escalação.`
                    : availableStarters < 11
                      ? "Complete os 11 titulares antes de entrar em campo."
                      : tiredStarters.length
                        ? `${tiredStarters.length} titular(es) cansado(s). Confira a condição da equipe.`
                        : "Escalação completa. Sua equipe está pronta."}
                </p>
                <div>
                  <Link to="/tactics" className="career-secondary-button">
                    <LayoutGrid size={16} />
                    Preparar equipe
                  </Link>
                  <Link to="/match" className="career-primary-button">
                    <Play size={16} />
                    Ir para o jogo
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="trainer-season-end">
              <Trophy size={40} />
              <h3>Temporada encerrada</h3>
              <p>Confira os resultados e a evolução do seu clube.</p>
              <Link to="/league" className="career-primary-button">
                Ver classificação <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>

        <section className="trainer-preparation" aria-labelledby="preparation-title">
          <div className="trainer-section-heading">
            <h2 id="preparation-title">Antes de entrar em campo</h2>
            <span className="trainer-preparation-count">Rodada {career.round}</span>
          </div>
          <Link to="/squad" className="trainer-task">
            <span
              className={
                availableStarters === 11
                  ? "trainer-task-icon is-ready"
                  : "trainer-task-icon is-warning"
              }
            >
              {availableStarters === 11 ? <CheckCircle2 size={19} /> : <ShieldAlert size={19} />}
            </span>
            <div>
              <strong>Confira a escalação</strong>
              <p>{availableStarters}/11 titulares disponíveis</p>
            </div>
            <ArrowRight size={16} />
          </Link>
          <Link to="/tactics" className="trainer-task">
            <span className="trainer-task-icon">
              <LayoutGrid size={19} />
            </span>
            <div>
              <strong>Defina seu plano de jogo</strong>
              <p>
                {career.tactics.formation} · {MENTALITIES[career.tactics.mentality]}
              </p>
            </div>
            <ArrowRight size={16} />
          </Link>
          <Link to="/training" className="trainer-task">
            <span className={`trainer-task-icon ${drillDone ? "is-ready" : ""}`}>
              <Dumbbell size={19} />
            </span>
            <div>
              <strong>Prepare o time no treino</strong>
              <p>
                {drillDone ? "Exercício da rodada concluído" : "Exercício da rodada disponível"}
              </p>
            </div>
            <ArrowRight size={16} />
          </Link>
          <p className="trainer-preparation-note">
            Uma boa preparação começa fora das quatro linhas.
          </p>
        </section>
      </div>

      {(unavailableStarters.length > 0 || tiredStarters.length > 0 || unhappy > 0) && (
        <aside className="trainer-attention" aria-label="Atenção ao elenco">
          <HeartPulse size={20} />
          <div>
            <strong>O elenco precisa da sua atenção</strong>
            <p>
              {[
                unavailableStarters.length
                  ? `Indisponíveis na escalação: ${unavailableStarters.map((p) => p.name).join(", ")}`
                  : "",
                tiredStarters.length
                  ? `${tiredStarters.length} titular(es) com condição abaixo de 65%`
                  : "",
                unhappy ? `${unhappy} jogador(es) insatisfeito(s)` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Link to="/squad">
            Revisar elenco <ArrowRight size={15} />
          </Link>
        </aside>
      )}

      <div className="trainer-summary" aria-label="Resumo da temporada">
        <Link to="/league">
          <span>
            Na liga <Trophy size={16} aria-hidden="true" />
          </span>
          <strong>
            {pos > 0 ? `${pos}º` : "—"}
            <small>{myRow?.pts ?? 0} pontos</small>
          </strong>
          <p>Meta: {career.objective}º ou melhor</p>
        </Link>
        <Link to="/finances">
          <span>
            Caixa disponível <Coins size={16} aria-hidden="true" />
          </span>
          <strong>{formatMoney(career.finances.budget)}</strong>
          <p>
            Gerenciar orçamento <ArrowRight size={12} />
          </p>
        </Link>
        <Link to="/squad">
          <span>
            Condição do elenco <HeartPulse size={16} aria-hidden="true" />
          </span>
          <strong>
            {Math.round(
              players.reduce((sum, p) => sum + p.condition, 0) / Math.max(1, players.length),
            )}
            <small>/ 100</small>
          </strong>
          <p>
            {injured + suspended
              ? `${injured} lesionados · ${suspended} suspensos`
              : `${players.length} jogadores disponíveis`}
          </p>
        </Link>
        <Link to="/board">
          <span>
            Confiança da diretoria <ClipboardList size={16} aria-hidden="true" />
          </span>
          <strong>
            {Math.round(career.approval)}
            <small>%</small>
          </strong>
          <p>
            {pos <= career.objective
              ? "Dentro do objetivo da temporada"
              : "Acompanhar os objetivos"}
          </p>
        </Link>
      </div>

      <nav className="trainer-quick-actions" aria-label="Atalhos do clube">
        <Link to="/squad">
          <ClipboardList size={20} aria-hidden="true" />
          <span>
            <strong>Gerenciar elenco</strong>
            <small>Titulares e reservas</small>
          </span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link to="/training">
          <Dumbbell size={20} aria-hidden="true" />
          <span>
            <strong>Centro de treino</strong>
            <small>Evolução da equipe</small>
          </span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link to="/transfers">
          <ArrowLeftRight size={20} aria-hidden="true" />
          <span>
            <strong>Buscar reforços</strong>
            <small>Mercado e propostas</small>
          </span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link to="/finances">
          <Coins size={20} aria-hidden="true" />
          <span>
            <strong>Finanças do clube</strong>
            <small>Receitas e despesas</small>
          </span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </nav>

      {showOnboard && (
        <details className="trainer-onboarding">
          <summary>
            <span>Começando sua carreira?</span>
            <span>Veja os 3 primeiros passos</span>
          </summary>
          <div>
            <ol>
              <li>
                <Link to="/squad">
                  1. Conheça os jogadores e escolha os titulares <ArrowRight size={14} />
                </Link>
              </li>
              <li>
                <Link to="/tactics">
                  2. Ajuste a formação e o estilo de jogo <ArrowRight size={14} />
                </Link>
              </li>
              <li>
                <Link to="/match">
                  3. Entre em campo para a primeira partida <ArrowRight size={14} />
                </Link>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(onboardKey, "1");
                } catch {
                  /* The current visit can still dismiss the guide. */
                }
                setOnboardDone(true);
              }}
            >
              Já conheço o jogo
            </button>
          </div>
        </details>
      )}

      <div className="trainer-section-heading trainer-overview-heading">
        <div>
          <p className="trainer-eyebrow">Visão do clube</p>
          <h2>Acompanhe sua temporada</h2>
        </div>
        <Link to="/club">
          Central do clube <ArrowRight size={15} />
        </Link>
      </div>
      <div className="trainer-club-grid grid grid-flow-dense items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                career.streak > 0
                  ? `${career.streak}V`
                  : career.streak < 0
                    ? `${-career.streak}D`
                    : "—"
              }
            />
          </div>
        </HudCard>

        {/* Finanças */}
        <HudCard
          title="Finanças do clube"
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
          <p className="mt-2 text-xs text-muted-foreground">Orçamento para administrar seu clube</p>
          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Folha semanal</dt>
              <dd className="hud-num">{formatMoney(wageWeek / 1000)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Patrocínio por rodada</dt>
              <dd className="hud-num">{formatMoney(career.sponsor)}</dd>
            </div>
          </dl>
        </HudCard>

        {/* Elenco */}
        <HudCard
          title="Saúde do elenco"
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

        {/* Tática atual */}
        <HudCard
          title="Tática atual"
          tone="neutral"
          badge={<HudChip>{career.tactics.formation}</HudChip>}
          action={
            <Link to="/tactics" className="text-[10px] font-bold uppercase text-tone">
              Editar
            </Link>
          }
        >
          <div className="relative aspect-[5/3] w-full overflow-hidden rounded-lg border border-border/60 bg-[color-mix(in_oklab,var(--primary)_14%,transparent)]">
            <span className="absolute inset-y-2 left-1/2 w-px bg-foreground/15" aria-hidden />
            <span
              className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/15"
              aria-hidden
            />
            {FORMATIONS[career.tactics.formation].map((slot, i) => (
              <span
                key={`${slot.label}-${i}`}
                className="hud-num absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground"
                style={{
                  left: `${((slot.x + 1) / 2) * 90 + 5}%`,
                  top: `${((slot.z + 1) / 2) * 80 + 10}%`,
                }}
              >
                {slot.label}
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <p>Mentalidade: {MENTALITIES[career.tactics.mentality]}</p>
            <p>Marcação: {PRESSING[career.tactics.pressing]}</p>
            <p>Largura: {WIDTHS[career.tactics.width]}</p>
            <p>Ritmo: {TEMPOS[career.tactics.tempo]}</p>
          </div>
        </HudCard>

        {/* Histórico de jogos */}
        <HudCard
          title="Resultados recentes"
          tone="neutral"
          action={
            <Link to="/history" className="text-[10px] font-bold uppercase text-tone">
              Histórico
            </Link>
          }
        >
          <ul className="space-y-2">
            {mine
              .slice(-6)
              .reverse()
              .map((r, i) => {
                const home = r.home === career.clubId;
                const gf = home ? r.hg : r.ag;
                const ga = home ? r.ag : r.hg;
                const rivalId = home ? r.away : r.home;
                const rival = CLUBS[rivalId];
                const res = gf > ga ? "V" : gf === ga ? "E" : "D";
                return (
                  <li
                    key={`${r.round}-${rivalId}-${i}`}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-foreground/[0.03] px-2 py-1.5"
                  >
                    <span
                      className={`hud-num grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold ${
                        res === "V"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : res === "E"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {res}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {home ? "vs" : "@"} {rival?.name ?? rivalId}
                    </span>
                    <span className="hud-num text-xs font-bold">
                      {gf}–{ga}
                    </span>
                  </li>
                );
              })}
            {mine.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhuma partida disputada ainda.</li>
            )}
          </ul>
        </HudCard>

        <ClubHeritagePanel clubId={career.clubId} compact className="md:col-span-2" />
        <ClubHonoursPanel clubId={career.clubId} />

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
