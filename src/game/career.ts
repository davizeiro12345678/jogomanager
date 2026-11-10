import { pickLineup } from "./career-lineup";
import { defaultV3, enrichPlayer, withCustomPlayers, withRealPlayers } from "./career-squad";
export {
  buildReadySquad,
  defaultV3,
  enrichPlayer,
  withCustomPlayers,
  withRealPlayers,
} from "./career-squad";
export { pickLineup } from "./career-lineup";
export {
  careerMatchContext,
  careerMatchSelection,
  quickSimulate,
  recentForm,
  squadFatigue,
  type QuickSimContext,
  type QuickSimEvent,
} from "./career-quick-sim";
import { CLUBS, getLeague } from "./data/leagues";
import { valueFor } from "./economy";
import { makeRng } from "./rng";
import { withCareerWorld } from "./career-world";
import { withDevelopmentBase } from "./attributes";
import { MAX_PREMIUM_SCOUT_REPORTS, validWorkCount } from "./transfer-inputs";

import { generateFixtures } from "./season";
import { buildSquad } from "./squad";
import type { CareerState, FormationKey, ManagerProfile, Position, ScoutReport } from "./types";
export { migrateCareer } from "./career-migration";
export { acceptOffer, rejectOffer, takeJob, resign } from "./career-jobs";
export { upgradeStaff, runScouting } from "./career-staff";

export function initCareer(
  leagueId: string,
  clubId: string,
  managerName: string,
  profile?: ManagerProfile,
): CareerState {
  const club = CLUBS[clubId]!;
  const squad = withCustomPlayers(
    clubId,
    withRealPlayers(clubId, buildSquad(clubId).map(enrichPlayer)),
  ).map((p) => {
    const frozen = withDevelopmentBase(p, 2);
    return {
      ...frozen,
      value: valueFor(p.ovr, p.age, {
        economyRulesVersion: 2,
        potential: p.potential,
        contractYears: p.contractYears,
      }),
    };
  });
  const formation: FormationKey = "4-3-3";
  const { lineup, bench } = pickLineup(squad, formation);
  const objective = Math.max(1, Math.min(15, Math.round((96 - club.strength) / 4)));
  const base = defaultV3(club);
  const rep = profile?.reputation ?? 3;
  const loved = profile?.favClub === clubId;
  const budget = Math.round(club.strength * 0.9 * (0.7 + rep * 0.12) * 10) / 10;
  const approval = Math.max(20, Math.min(95, (profile?.approval ?? 62) + (loved ? 8 : 0)));

  return withCareerWorld({
    version: 3,
    catalogRevision: 1,
    simulationRatingRevision: 1,
    economyRulesVersion: 2,
    developmentRulesVersion: 2,
    developmentSeasonStart: {
      season: 1,
      ratings: Object.fromEntries(squad.map((p) => [p.id, p.ovr])),
    },
    leagueId,
    clubId,
    managerName,
    season: 1,
    round: 1,
    tactics: { formation, mentality: 2, pressing: 1, width: 1, tempo: 1 },
    training: "equilibrado",
    lineup,
    bench,
    fixtures: generateFixtures(leagueId, `${clubId}-${managerName}`),
    players: Object.fromEntries(squad.map((p) => [p.id, p])),
    results: [],
    finances: {
      budget,
      spent: 0,
      income: 0,
    },
    approval,
    objective,
    news: [
      {
        id: "welcome",
        season: 1,
        round: 1,
        kind: "sistema",
        title: `${managerName} assume o ${club.name}!`,
        body: `A diretoria espera pelo menos a ${objective}ª posição na ${getLeague(leagueId).name}. Boa sorte, treinador!`,
      },
    ],
    trophies: [],
    history: [],
    ...base,
    fanApproval: Math.max(30, Math.min(95, base.fanApproval + (loved ? 12 : 0) + (rep - 3) * 4)),
    pressure: Math.max(5, base.pressure - (rep - 3) * 4 - (loved ? 5 : 0)),
    ...(profile ? { manager: profile } : {}),
    transferredIn: [],
    seenScenes: [],
    managerHistory: [{ clubId, from: 1, to: null, note: "Contratado" }],
  });
}

export function orderedPositions(): Position[] {
  return ["GK", "DF", "MF", "FW"];
}

export { advanceRound, type MatchPerformance } from "./career-round";

/**
 * Relatório premium (comprado na loja ou do passe): mapeia jovens de até 23
 * anos com o maior potencial entre clubes sorteados e soma aos relatórios
 * existentes, sem repetir jogador.
 */
export function runPremiumScouting(state: CareerState, nonce: string, size = 5): CareerState {
  if (!validWorkCount(size, MAX_PREMIUM_SCOUT_REPORTS) || size === 0) return state;
  const rnd = makeRng(`premium-scout-${state.clubId}-${state.season}-${nonce}`);
  const ids = Object.keys(CLUBS).filter((id) => id !== state.clubId);
  const known = new Set(state.scoutReports.map((r) => r.playerId));
  const candidates: ScoutReport[] = [];
  for (let i = 0; i < size * 4 && ids.length > 0; i++) {
    const clubId = ids[Math.floor(rnd() * ids.length)]!;
    for (const p of buildSquad(clubId).map(enrichPlayer)) {
      if (p.age > 23 || known.has(p.id)) continue;
      candidates.push({
        id: `psc-${p.id}-${state.season}-${nonce}`,
        playerId: p.id,
        name: p.name,
        clubId,
        pos: p.pos,
        ovr: p.ovr,
        potential: p.potential ?? p.ovr,
        age: p.age,
        value: p.value,
        season: state.season,
      });
    }
  }
  const picked: ScoutReport[] = [];
  for (const r of candidates.sort((a, b) => b.potential - a.potential)) {
    if (picked.length >= size) break;
    if (picked.some((x) => x.playerId === r.playerId)) continue;
    picked.push(r);
  }
  return { ...state, scoutReports: [...picked, ...state.scoutReports].slice(0, 40) };
}
