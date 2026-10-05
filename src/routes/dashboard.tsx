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
        <div>
          <p className="trainer-eyebrow">Sua central de decisões</p>
          <h1>Painel do treinador</h1>
          <p>
            {fixture
              ? `Prepare o ${club.name} para o próximo desafio.`
              : `Veja o balanço da temporada do ${club.name}.`}
          </p>
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

