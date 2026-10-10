import { CLUBS, getLeague, LEAGUES } from "./data/leagues";
import { valueFor, wageFor } from "./economy";
import { safeMoney } from "./financial-inputs";
import { effectivePlayer } from "./player-development";
import { makeRng } from "./rng";
import { computeTable } from "./season";
import { supporterOccupancy } from "./career-world";
import type { CareerState, JobOffer, NewsItem, Player, ScoutReport, TransferOffer } from "./types";

/* ------------------------------------------------------------ helpers */

export function defaultStaff() {
  return { assistente: 1, preparador: 1, medico: 1, olheiro: 1 };
}

export function staffCost(level: number): number {
  return Math.round(level * 0.35 * 100) / 100;
}

/** custo semanal total do staff (M€) */
export function staffBill(state: CareerState): number {
  const s = state.staff ?? defaultStaff();
  return (
    Math.round(
      (staffCost(s.assistente) +
        staffCost(s.preparador) +
        staffCost(s.medico) +
        staffCost(s.olheiro)) *
        100,
    ) / 100
  );
}

/** receita de bilheteria por rodada em casa (M€) */
export function gateIncome(state: CareerState): number {
  const fill = supporterOccupancy(state);
  return safeMoney(((state.capacity ?? 45000) * fill * state.ticketPrice) / 1_000_000);
}

export function potentialOf(p: Player): number {
  return p.potential ?? Math.min(99, p.ovr + (p.age <= 21 ? 9 : p.age <= 25 ? 5 : 1));
}

export function formOf(p: Player): number {
  return p.form ?? Math.round((p.morale + p.condition) / 2);
}

function push(list: NewsItem[], item: NewsItem) {
  list.push(item);
}

/* --------------------------------------------------- clubes interessados */

function rivalClubs(state: CareerState, rnd: () => number) {
  const pool = LEAGUES.flatMap((l) => l.clubs).filter((c) => c.id !== state.clubId);
  const picks: string[] = [];
  for (let i = 0; i < 4; i++) {
    const c = pool[Math.floor(rnd() * pool.length)];
    if (c) picks.push(c.id);
  }
  return picks;
}

/** Gera propostas de outros clubes pelos seus jogadores. */
export function generateOffers(state: CareerState, rnd: () => number): TransferOffer[] {
  const offers: TransferOffer[] = [];
  const squad = Object.values(state.players)
    .filter((p) => p.clubId === state.clubId)
    .map((p) => effectivePlayer(p, state))
    .sort((a, b) => b.ovr - a.ovr);
  const targets = squad.slice(0, 8);
  const suitors = rivalClubs(state, rnd);

  for (const p of targets) {
    if (rnd() > 0.14) continue;
    const suitorId = suitors[Math.floor(rnd() * suitors.length)];
    const suitor = suitorId ? CLUBS[suitorId] : undefined;
    if (!suitor) continue;
    const value =
      state.economyRulesVersion === 2
        ? valueFor(p.ovr, p.age, {
            economyRulesVersion: 2,
            potential: p.potential,
            contractYears: p.contractYears,
          })
        : p.value > 0
          ? p.value
          : valueFor(p.ovr, p.age);
    const mult = suitor.strength > p.ovr ? 1.05 + rnd() * 0.55 : 0.7 + rnd() * 0.4;
    offers.push({
      id: `off-${p.id}-${state.season}-${state.round}`,
      playerId: p.id,
      clubId: suitor.id,
      amount: safeMoney(value * mult),
      wage: Math.round(wageFor(p.ovr) * (1.1 + rnd() * 0.5)),
      season: state.season,
      round: state.round,
      expiresRound: state.round + 3,
    });
  }
  return offers;
}

/** Gera sondagens de clubes interessados em você como treinador. */
export function generateJobOffers(state: CareerState, rnd: () => number): JobOffer[] {
  const table = computeTable(state);
  const pos = table.findIndex((r) => r.clubId === state.clubId) + 1 || 10;
  const doingWell = pos <= Math.max(3, state.objective - 1) || state.approval >= 78;
  if (!doingWell || rnd() > 0.12) return [];

  const league = LEAGUES[Math.floor(rnd() * LEAGUES.length)]!;
  const club = league.clubs[Math.floor(rnd() * league.clubs.length)];
  if (!club || club.id === state.clubId) return [];

  return [
    {
      id: `job-${club.id}-${state.season}-${state.round}`,
      clubId: club.id,
      leagueId: league.id,
      season: state.season,
      round: state.round,
      expiresRound: state.round + 4,
      budget: Math.round(club.strength * 1.1 * 10) / 10,
      objective: Math.max(1, Math.min(15, Math.round((96 - club.strength) / 4))),
    },
  ];
}

/* --------------------------------------------------- eventos dinâmicos */

const DRESSING_EVENTS = [
  {
    kind: "sistema" as const,
    title: (n: string) => `${n} pede mais minutos`,
    body: (n: string) => `${n} conversou com a comissão e reclamou do tempo de jogo.`,
    apply: (p: Player): Player => ({ ...p, unhappy: true, morale: Math.max(30, p.morale - 8) }),
  },
  {
    kind: "sistema" as const,
    title: (n: string) => `${n} é eleito líder do vestiário`,
    body: (n: string) => `O elenco reconhece a liderança de ${n}, e a moral do grupo sobe.`,
    apply: (p: Player): Player => ({
      ...p,
      personality: "líder",
      morale: Math.min(99, p.morale + 6),
    }),
  },
  {
    kind: "premio" as const,
    title: (n: string) => `${n} é o jogador do mês`,
    body: (n: string) => `A imprensa elegeu ${n} o melhor da rodada — moral nas alturas.`,
    apply: (p: Player): Player => ({ ...p, morale: Math.min(99, p.morale + 10), form: 92 }),
  },
  {
    kind: "sistema" as const,
    title: (n: string) => `Atrito no treino envolvendo ${n}`,
    body: (n: string) => `${n} se desentendeu com um companheiro; o clima ficou pesado.`,
    apply: (p: Player): Player => ({ ...p, morale: Math.max(25, p.morale - 12) }),
  },
];

export interface WeeklyEvents {
  players: Record<string, Player>;
  news: NewsItem[];
  offers: TransferOffer[];
  jobOffers: JobOffer[];
}

/** Eventos dinâmicos da rodada: bastidores, propostas e sondagens. */
export function runWeeklyEvents(state: CareerState): WeeklyEvents {
  const rnd = makeRng(`ev-${state.clubId}-${state.season}-${state.round}`);
  const news: NewsItem[] = [];
  const players = { ...state.players };
  const squad = Object.values(players);

  // bastidores
  if (squad.length && rnd() < 0.35) {
    const p = squad[Math.floor(rnd() * squad.length)]!;
    const ev = DRESSING_EVENTS[Math.floor(rnd() * DRESSING_EVENTS.length)]!;
    players[p.id] = ev.apply(p);
    push(news, {
      id: `dr-${p.id}-${state.season}-${state.round}`,
      season: state.season,
      round: state.round,
      kind: ev.kind,
      title: ev.title(p.name),
      body: ev.body(p.name),
    });
  }

  const offers = generateOffers(state, rnd).filter(
    (o) => !state.offers?.some((x) => x.playerId === o.playerId),
  );
  for (const o of offers) {
    const club = CLUBS[o.clubId];
    const p = players[o.playerId];
    if (!club || !p) continue;
    push(news, {
      id: `oi-${o.id}`,
      season: state.season,
      round: state.round,
      kind: "mercado",
      title: `${club.name} sonda ${p.name}`,
      body: `Proposta de €${o.amount.toFixed(1)}M por ${p.name}. Decida no Mercado.`,
    });
  }

  const jobOffers = generateJobOffers(state, rnd);
  for (const j of jobOffers) {
    const club = CLUBS[j.clubId];
    if (!club) continue;
    push(news, {
      id: `ji-${j.id}`,
      season: state.season,
      round: state.round,
      kind: "sistema",
      title: `${club.name} quer você`,
      body: `A diretoria do ${club.name} (${getLeague(j.leagueId).name}) fez uma sondagem pelo seu trabalho.`,
    });
  }

  return { players, news, offers, jobOffers };
}

/* --------------------------------------------------- diretoria/demissão */

export function pressureDelta(won: boolean, draw: boolean, position: number, objective: number) {
  const base = won ? -6 : draw ? -1 : 6;
  const gap = position - objective;
  return base + (gap > 0 ? Math.min(6, gap) : -2);
}

/** Verifica risco de demissão e retorna o estado ajustado. */
export function checkSacking(state: CareerState): CareerState {
  if (state.pressure < 100 || state.sacked) return state;
  const club = CLUBS[state.clubId];
  const rnd = makeRng(`sack-${state.clubId}-${state.season}-${state.round}`);
  const offers = generateJobOffers({ ...state, approval: 80 }, rnd);
  return {
    ...state,
    sacked: true,
    jobOffers: offers.length ? offers : freeAgentOffers(state, rnd),
    managerHistory: closeSpell(state, "Demitido"),
    news: [
      {
        id: `sack-${state.season}-${state.round}`,
        season: state.season,
        round: state.round,
        kind: "sistema" as const,

        title: `Você foi demitido do ${club?.name ?? "clube"}`,
        body: "A diretoria perdeu a paciência com os resultados. Escolha um novo projeto na sala da diretoria.",
      },
      ...state.news,
    ].slice(0, 60),
  };
}

function freeAgentOffers(state: CareerState, rnd: () => number): JobOffer[] {
  const league = LEAGUES[Math.floor(rnd() * LEAGUES.length)]!;
  const weak = [...league.clubs].sort((a, b) => a.strength - b.strength)[0]!;
  return [
    {
      id: `job-free-${weak.id}-${state.season}`,
      clubId: weak.id,
      leagueId: league.id,
      season: state.season,
      round: state.round,
      expiresRound: state.round + 99,
      budget: Math.round(weak.strength * 0.8 * 10) / 10,
      objective: 14,
    },
  ];
}

export function closeSpell(state: CareerState, note: string) {
  const hist = state.managerHistory ?? [];
  const open = hist.findIndex((h) => h.clubId === state.clubId && h.to === null);
  if (open === -1) {
    return [...hist, { clubId: state.clubId, from: state.season, to: state.season, note }];
  }
  const next = [...hist];
  next[open] = { ...next[open]!, to: state.season, note };
  return next;
}
