import { CLUBS } from "./data/leagues";
import { closeSpell } from "./events";
import { makeRng } from "./rng";
import { leagueClubIds } from "./pyramid";
import { withDevelopmentBase } from "./attributes";
import { financialChange, finiteAmount, safeMoney, validFinancialState } from "./financial-inputs";
import { generateFixtures } from "./season";
import { buildSquad } from "./squad";
import type { CareerState } from "./types";
import { pickLineup, withCustomPlayers, withRealPlayers } from "./career";

/** Aceita uma proposta por um dos seus jogadores. */
export function acceptOffer(state: CareerState, offerId: string): CareerState {
  if (!validFinancialState(state)) return state;
  const offer = (state.offers ?? []).find((o) => o.id === offerId);
  if (
    !offer ||
    offer.season !== state.season ||
    offer.expiresRound < state.round ||
    !finiteAmount(offer.amount) ||
    !CLUBS[offer.clubId] ||
    offer.clubId === state.clubId
  )
    return state;
  const player = state.players[offer.playerId];
  if (!player || player.clubId !== state.clubId) return state;
  if (Object.values(state.players).filter((p) => p.clubId === state.clubId).length <= 16)
    return state;
  const finances = financialChange(state, offer.amount, 0);
  if (!finances) return state;
  const players = { ...state.players };
  delete players[offer.playerId];
  const club = CLUBS[offer.clubId];

  return {
    ...state,
    players,
    lineup: state.lineup.filter((id) => id !== offer.playerId),
    bench: state.bench.filter((id) => id !== offer.playerId),
    offers: (state.offers ?? []).filter((o) => o.playerId !== offer.playerId),
    finances,
    financeLedger: [
      {
        id: `sale-${state.clubId}-${state.season}-${state.round}-${offer.playerId}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        label: `Venda de ${player.name} ao ${club?.name ?? "exterior"}`,
        income: safeMoney(offer.amount),
        expense: 0,
      },
      ...financeLedgerFor(state),
    ].slice(0, 96),
    fanApproval: Math.max(5, (state.fanApproval ?? 60) - (player.ovr >= 80 ? 6 : 2)),
    news: [
      {
        id: `sold-${offer.id}`,
        season: state.season,
        round: state.round,
        kind: "mercado" as const,
        title: `${player.name} vendido ao ${club?.name ?? "exterior"}`,
        body: `Transferência fechada por €${offer.amount.toFixed(1)}M.`,
      },
      ...state.news,
    ].slice(0, 60),
  };
}

export function rejectOffer(state: CareerState, offerId: string): CareerState {
  const offer = (state.offers ?? []).find((o) => o.id === offerId);
  const rejected = new Set(state.rejectedOffers ?? []);
  // recusar a saída magoa: o jogador entra na lista de insatisfeitos
  if (offer && !rejected.has(offer.playerId)) {
    const p = state.players[offer.playerId];
    if (p && p.ovr >= 74) {
      rejected.add(offer.playerId);
      return {
        ...state,
        offers: (state.offers ?? []).filter((o) => o.id !== offerId),
        rejectedOffers: [...rejected],
        players: {
          ...state.players,
          [offer.playerId]: { ...p, morale: Math.max(10, p.morale - 6) },
        },
      };
    }
  }
  return { ...state, offers: (state.offers ?? []).filter((o) => o.id !== offerId) };
}

/** Assume um novo clube (após demissão, pedido de demissão ou convite). */
export function takeJob(state: CareerState, jobId: string): CareerState {
  const job = (state.jobOffers ?? []).find((j) => j.id === jobId);
  if (
    !job ||
    job.season !== state.season ||
    job.expiresRound < state.round ||
    !finiteAmount(job.budget)
  )
    return state;
  const club = CLUBS[job.clubId];
  const leagueId =
    Object.entries(state.leagueClubs ?? {}).find(([, ids]) => ids.includes(job.clubId))?.[0] ??
    club?.league;
  if (!club || !leagueId || job.clubId === state.clubId) return state;
  const squad = withCustomPlayers(
    job.clubId,
    withRealPlayers(job.clubId, buildSquad(job.clubId)),
  ).map((p) => withDevelopmentBase(p, state.developmentRulesVersion === 2 ? 2 : 1));
  const { lineup, bench } = pickLineup(squad, state.tactics.formation);
  const history = state.sacked ? (state.managerHistory ?? []) : closeSpell(state, "Saiu do clube");

  return {
    ...state,
    leagueId,
    clubId: job.clubId,
    round: 1,
    fixtures: generateFixtures(
      leagueId,
      `${job.clubId}-${state.managerName}-s${state.season}`,
      leagueClubIds(state, leagueId),
    ),
    players: Object.fromEntries(squad.map((p) => [p.id, p])),
    lineup,
    bench,
    results: [],
    cups: [],
    finances: { budget: job.budget, spent: 0, income: 0 },
    financeSettledThrough: undefined,
    attrDeltas: {},
    ...(state.developmentRulesVersion === 2
      ? {
          developmentSeasonStart: {
            season: state.season,
            ratings: Object.fromEntries(squad.map((p) => [p.id, p.ovr])),
          },
        }
      : {}),
    approval: 60,
    objective: job.objective,
    ...defaultV3(club),
    fanApproval: 58,
    pressure: 20,
    offers: [],
    jobOffers: [],
    sacked: false,

    managerHistory: [
      ...history,
      { clubId: job.clubId, from: state.season, to: null, note: "Contratado" },
    ],
    news: [
      {
        id: `hire-${job.id}`,
        season: state.season,
        round: state.round,
        kind: "sistema" as const,
        title: `Novo desafio: ${club.name}`,
        body: `Você assinou com o ${club.name}. Objetivo: ${job.objective}º lugar ou melhor.`,
      },
      ...state.news,
    ].slice(0, 60),
  };
}

/** Pede demissão: fica sem clube e recebe convites. */
export function resign(state: CareerState): CareerState {
  const rnd = makeRng(`resign-${state.clubId}-${state.season}-${state.round}`);
  const offers = state.jobOffers?.length ? state.jobOffers : [];
  return {
    ...state,
    sacked: true,
    jobOffers: offers.length
      ? offers
      : [
          {
            id: `job-open-${state.season}-${state.round}`,
            clubId: pickRandomClubId(rnd, state.clubId),
            leagueId: state.leagueId,
            season: state.season,
            round: state.round,
            expiresRound: state.round + 99,
            budget: 20,
            objective: 10,
          },
        ],
    managerHistory: closeSpell(state, "Pediu demissão"),
    news: [
      {
        id: `resign-${state.season}-${state.round}`,
        season: state.season,
        round: state.round,
        kind: "sistema" as const,
        title: "Você pediu demissão",
        body: "Hora de buscar um novo projeto na sala da diretoria.",
      },
      ...state.news,
    ].slice(0, 60),
  };
}

export function pickRandomClubId(rnd: () => number, exclude: string): string {
  const ids = Object.keys(CLUBS).filter((id) => id !== exclude);
  return ids[Math.floor(rnd() * ids.length)] ?? exclude;
}
