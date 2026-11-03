/**
 * Career effects of coin services. Coins are charged by the server first; these
 * pure functions only change the player's own save afterwards.
 */
import { INJURY_RECOVERY_WEEKS } from "@/lib/wallet-rules";
import { CLUBS } from "./data/leagues";
import { computeTable, nextFixture } from "./season";
import type { CareerState } from "./types";

export function applyInjuryRecovery(career: CareerState, playerId: string): CareerState {
  const player = career.players[playerId];
  if (!player || player.injuryWeeks <= 0) return career;
  return {
    ...career,
    players: {
      ...career.players,
      [playerId]: { ...player, injuryWeeks: Math.max(0, player.injuryWeeks - INJURY_RECOVERY_WEEKS) },
    },
  };
}

export interface OpponentReport {
  opponentId: string;
  opponentName: string;
  round: number;
  atHome: boolean;
  position: number | null;
  form: ("V" | "E" | "D")[];
  goalsForAvg: number;
  goalsAgainstAvg: number;
  secondHalfGoalShare: number | null;
  strengthGap: number;
  approach: string;
  advice: string;
}

const avg = (total: number, n: number) => (n > 0 ? Math.round((total / n) * 10) / 10 : 0);

export function opponentReport(career: CareerState): OpponentReport | null {
  const fixture = nextFixture(career);
  if (!fixture) return null;
  const atHome = fixture.home === career.clubId;
  const opponentId = atHome ? fixture.away : fixture.home;
  const played = career.fixtures.filter(
    (f) => f.homeGoals !== null && f.awayGoals !== null && (f.home === opponentId || f.away === opponentId),
  );
  let gf = 0;
  let ga = 0;
  let goals = 0;
  let secondHalf = 0;
  const form: ("V" | "E" | "D")[] = [];
  for (const f of played) {
    const home = f.home === opponentId;
    const scored = (home ? f.homeGoals : f.awayGoals) ?? 0;
    const conceded = (home ? f.awayGoals : f.homeGoals) ?? 0;
    gf += scored;
    ga += conceded;
    form.push(scored > conceded ? "V" : scored === conceded ? "E" : "D");
    for (const e of f.events ?? []) {
      const theirs = (e.side === "home") === home && e.kind !== "vermelho";
      if (!theirs) continue;
      goals += 1;
      if (e.minute > 45) secondHalf += 1;
    }
  }
  const table = computeTable(career);
  const index = table.findIndex((row) => row.clubId === opponentId);
  const strengthGap = (CLUBS[opponentId]?.strength ?? 70) - (CLUBS[career.clubId]?.strength ?? 70);
  const goalsForAvg = avg(gf, played.length);
  const goalsAgainstAvg = avg(ga, played.length);
  const approach =
    strengthGap >= 4
      ? "Deve tomar a iniciativa, ficar com a bola e pressionar alto."
      : strengthGap <= -4
        ? "Deve se fechar atrás e apostar no contra-ataque."
        : "Jogo equilibrado: deve alternar posse e transições rápidas.";
  const advice =
    goalsAgainstAvg >= 1.6
      ? "A defesa deles sofre muito: vale uma mentalidade ofensiva."
      : goalsForAvg >= 1.8
        ? "O ataque deles é perigoso: reforce o meio e evite deixar espaço nas costas."
        : strengthGap >= 4
          ? "Feche os espaços e saia rápido quando recuperar a bola."
          : "Pressione a saída de bola para forçar erros.";
  return {
    opponentId,
    opponentName: CLUBS[opponentId]?.name ?? "Adversário",
    round: fixture.round,
    atHome,
    position: index >= 0 ? index + 1 : null,
    form: form.slice(-5),
    goalsForAvg,
    goalsAgainstAvg,
    secondHalfGoalShare: goals >= 3 ? Math.round((secondHalf / goals) * 100) : null,
    strengthGap,
    approach,
    advice,
  };
}
