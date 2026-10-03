import { CLUBS, getLeague } from "./data/leagues";
import { seasonPrize, valueFor, wageFor, weeklyIncome } from "./economy";
import {
  checkSacking,
  closeSpell,
  defaultStaff,
  gateIncome,
  pressureDelta,
  runWeeklyEvents,
  staffBill,
} from "./events";
import { customPlayersFor, toGamePlayer } from "@/lib/customData";
import { realSquadFor } from "@/lib/realSquads";
import { applyImportedSquad } from "./squad-import";
import { updatedSeasonComposition } from "./catalog-season";
import { FORMATIONS } from "./formations";
import { makeRng } from "./rng";
import { expectedGoals, regulationScore, type MatchConditions } from "./match-probability";
import { selectionRating } from "./match-readiness";
import { migrateSquadRatings } from "./squad-rating-migration";
import { applyRegens } from "./regen";
import { checkSeasonIntegrity } from "./season-integrity";
import { repairCareer } from "./career-repair";
import { recordWorldTransition, withCareerWorld } from "./career-world";
import { applyPyramid, leagueClubIds, REGIONAL_LINKS } from "./pyramid";
import {
  applyRegionalEntries,
  resolveQualifications,
  regionalFinals,
  seasonTables,
  seasonCompetitionRecord,
  topLeague,
} from "./competition-season";
import { calendarYear, countryRegulation } from "./competition-regulations";
import { evolveSeason, setAttrDeltas } from "./attributes";

import { computeTable, generateFixtures } from "./season";
import { settlePromises } from "./unhappy";
import { evaluateAchievements } from "./achievements";
import { createCups, cupPrize, inGroupStage, nextPhaseName, playCupStage, stageName } from "./cup";
import { buildSquad, completeSquad } from "./squad";
import type {
  CareerState,
  CupState,
  Fixture,
  FixtureEvent,
  FormationKey,
  JobOffer,
  ManagerProfile,
  NewsItem,
  Player,
  Position,
  ScoutReport,
  TrainingFocus,
  Tactics,
  TransferOffer,
} from "./types";

/**
 * Ordem de improvisação por posição: um volante rende mais na zaga do que um
 * centroavante, e um ponta rende mais no meio do que um zagueiro no ataque.
 */
const COVER_ORDER: Record<Position, Position[]> = {
  GK: ["GK"],
  DF: ["DF", "MF", "FW"],
  MF: ["MF", "DF", "FW"],
  FW: ["FW", "MF", "DF"],
};

export function pickLineup(players: Player[], formation: FormationKey) {
  // Formação desconhecida (save antigo, tática corrompida): cai no 4-3-3 em vez
  // de estourar e derrubar a tela inteira.
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const available = [...players]
    .filter((p) => !p.suspended && p.injuryWeeks === 0)
    .sort((a, b) => selectionRating(b) - selectionRating(a) || a.id.localeCompare(b.id));
  const taken = new Set<string>();
  const picks: Player[] = new Array(slots.length).fill(undefined);

  // 1) Goleiro primeiro. A simulação procura `pos === "GK"` para defender o
  // chute: sem goleiro, todo chute é gol. Por isso a posição é preenchida
  // antes de qualquer outra e nunca por um jogador de linha enquanto houver
  // um goleiro disponível.
  const keepers = available.filter((p) => p.pos === "GK");
  let keeperCursor = 0;
  slots.forEach((slot, i) => {
    if (slot.pos !== "GK") return;
    const keeper = keepers[keeperCursor++];
    if (!keeper) return;
    taken.add(keeper.id);
    picks[i] = keeper;
  });

  // 2) Linha: posição exata, depois a ordem de improvisação mais parecida.
  // Goleiro nunca é gasto em vaga de linha.
  const cover = (pos: Position): Player | undefined => {
    for (const candidatePos of COVER_ORDER[pos] ?? ["DF", "MF", "FW"]) {
      const found = available.find((p) => !taken.has(p.id) && p.pos === candidatePos);
      if (found) return found;
    }
    return undefined;
  };
  slots.forEach((slot, i) => {
    if (slot.pos === "GK" || picks[i]) return;
    const found =
      cover(slot.pos) ??
      available.find((p) => !taken.has(p.id) && p.pos !== "GK") ??
      available.find((p) => !taken.has(p.id));
    if (!found) return;
    taken.add(found.id);
    picks[i] = found;
  });

  // 4) Elenco curto ou goleiros indisponíveis: completa as vagas que sobraram
  // com qualquer jogador livre, jogador de linha primeiro. É melhor um time com
  // 11 atletas (mesmo com um improviso no gol) do que um time com 10.
  slots.forEach((slot, i) => {
    if (picks[i]) return;
    const found =
      available.find((p) => !taken.has(p.id) && p.pos !== "GK") ??
      available.find((p) => !taken.has(p.id));
    if (!found) return;
    taken.add(found.id);
    picks[i] = found;
    void slot;
  });

  const lineup = picks.filter(Boolean).map((p) => p.id);

  // 3) Banco: melhores restantes, mas sempre com um goleiro. Sem reserva, uma
  // lesão na camisa 1 deixa o time sem ninguém na posição até o fim do jogo.
  const rest = available.filter((p) => !taken.has(p.id));
  const benchIds = rest.slice(0, 7).map((p) => p.id);
  if (!benchIds.some((id) => rest.find((p) => p.id === id)?.pos === "GK")) {
    const spareKeeper = rest.find((p) => p.pos === "GK");
    if (spareKeeper) {
      const weakestOutfield = [...benchIds].reverse().find((id) => {
        const p = rest.find((q) => q.id === id);
        return Boolean(p) && p!.pos !== "GK";
      });
      if (weakestOutfield) {
        benchIds.splice(benchIds.indexOf(weakestOutfield), 1);
        benchIds.unshift(spareKeeper.id);
      }
    }
  }
  return { lineup, bench: benchIds };
}

const PERSONALITIES = [
  "líder",
  "profissional",
  "ambicioso",
  "temperamental",
  "caseiro",
  "determinado",
] as const;

/**
 * Elenco pronto para jogo: montado a partir do catálogo e já enriquecido com
 * salário, valor de mercado, potencial e personalidade. Sem esta etapa as telas
 * de partida rápida mostravam `€0` de valor e salário, porque `buildSquad`
 * entrega os campos zerados.
 */
export function buildReadySquad(clubId: string): Player[] {
  return buildSquad(clubId).map(enrichPlayer);
}

export function enrichPlayer(p: Player): Player {
  const rnd = makeRng(`pl-${p.id}`);
  return {
    ...p,
    wage: p.wage > 0 ? p.wage : wageFor(p.ovr),
    value: p.value > 0 ? p.value : valueFor(p.ovr, p.age),
    yellows: p.yellows ?? 0,
    suspended: p.suspended ?? false,
    injuryWeeks: p.injuryWeeks ?? 0,
    potential:
      p.potential ??
      Math.min(
        99,
        p.ovr +
          (p.age <= 20
            ? 6 + Math.floor(rnd() * 8)
            : p.age <= 24
              ? 3 + Math.floor(rnd() * 6)
              : Math.floor(rnd() * 3)),
      ),
    personality: p.personality ?? PERSONALITIES[Math.floor(rnd() * PERSONALITIES.length)]!,
    form: p.form ?? Math.round((p.morale + p.condition) / 2),
    contractYears: p.contractYears ?? 1 + Math.floor(rnd() * 4),
    releaseClause:
      p.releaseClause ?? Math.round(valueFor(p.ovr, p.age) * (1.8 + rnd() * 1.4) * 10) / 10,
    unhappy: p.unhappy ?? false,
  };
}

function defaultV3(club: { strength: number } | undefined) {
  const s = club?.strength ?? 70;
  return {
    fanApproval: 62,
    pressure: 25,
    staff: defaultStaff(),
    sponsor: Math.round(s * 0.02 * 100) / 100,
    ticketPrice: 45,
    capacity: Math.round(12000 + s * 700),
    streak: 0,
    offers: [] as TransferOffer[],
    jobOffers: [] as JobOffer[],
    scoutReports: [] as ScoutReport[],
    sacked: false,
  };
}

/**
 * Junta os jogadores cadastrados pelo usuário ao elenco gerado.
 * Cada cadastro entra no lugar do jogador mais fraco da mesma posição
 * (ou simplesmente do mais fraco), mantendo o tamanho do plantel.
 */
function withCustomPlayers(clubId: string, squad: Player[]): Player[] {
  const custom = customPlayersFor(clubId);
  if (custom.length === 0) return squad;
  const list = [...squad];
  const usedNumbers = new Set(list.map((p) => p.number));

  custom.forEach((cp) => {
    let num = 2;
    while (usedNumbers.has(num) && num < 40) num++;
    usedNumbers.add(num);
    const player = enrichPlayer(toGamePlayer(cp, num));

    const samePos = list.filter((p) => p.pos === cp.pos).sort((a, b) => a.ovr - b.ovr)[0];
    const weakest = [...list].sort((a, b) => a.ovr - b.ovr)[0];
    const target = samePos ?? weakest;
    const idx = target ? list.findIndex((p) => p.id === target.id) : -1;
    if (idx >= 0) list[idx] = player;
    else list.push(player);
  });

  return list;
}

/**
 * Aplica os nomes reais importados das APIs por cima do elenco gerado.
 * A força de cada jogador continua vindo do balanceamento do jogo; o que muda
 * é quem veste a camisa: nome, idade, número, nacionalidade e foto.
 */
function withRealPlayers(clubId: string, squad: Player[]): Player[] {
  return applyImportedSquad(clubId, squad, realSquadFor(clubId)).map(enrichPlayer);
}

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
  );
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

/** Migra estados antigos (v1/v2) para o formato atual. */
export function migrateCareer(raw: unknown): CareerState {
  const { state: restored, fixes } = repairCareer(migrateCareerShape(raw));
  const repaired = migrateSquadRatings(restored);
  setAttrDeltas(repaired.attrDeltas ?? {});
  const state = withCareerWorld(upgradeCatalog(repaired));
  if (!fixes.length) return state;
  console.warn("[career-repair]", fixes);
  const id = `repair-${state.season}-${state.round}`;
  if (state.news.some((n) => n.id === id)) return state;
  return {
    ...state,
    news: [
      {
        id,
        season: state.season,
        round: state.round,
        kind: "sistema",
        title: "Save conferido e corrigido",
        body: `Corrigimos automaticamente: ${fixes.join("; ")}.`,
      },
      ...state.news,
    ],
  };
}

function upgradeCatalog(state: CareerState): CareerState {
  if (state.catalogRevision === 1) return state;
  const owned = Object.values(state.players).filter((p) => p.clubId === state.clubId);
  const completed = completeSquad(state.clubId, owned).map(
    (p) => state.players[p.id] ?? enrichPlayer(p),
  );
  const players = { ...state.players, ...Object.fromEntries(completed.map((p) => [p.id, p])) };
  // A season already in progress keeps its participants and all recorded scores.
  const participants = [...new Set(state.fixtures.flatMap((f) => [f.home, f.away]))];
  const leagueClubs = { ...state.leagueClubs };
  const pristine =
    state.season === 1 &&
    state.round === 1 &&
    !state.results.length &&
    !state.history.length &&
    state.fixtures.every((f) => f.homeGoals === null && f.awayGoals === null);
  if (pristine) {
    const clubs = getLeague(state.leagueId).clubs.map((c) => c.id);
    if (clubs.includes(state.clubId)) {
      leagueClubs[state.leagueId] = clubs;
      return {
        ...state,
        players,
        leagueClubs,
        catalogRevision: 1,
        fixtures: generateFixtures(state.leagueId, `${state.clubId}-${state.managerName}`, clubs),
      };
    }
  }
  if (participants.length) leagueClubs[state.leagueId] = participants;
  return {
    ...state,
    players,
    leagueClubs,
    catalogRevision: 1,
    ...(participants.length &&
    (participants.length !== getLeague(state.leagueId).clubs.length ||
      participants.some((id) => !getLeague(state.leagueId).clubs.some((c) => c.id === id)))
      ? { catalogCalendarPending: true }
      : {}),
  };
}

function migrateCareerShape(raw: unknown): CareerState {
  const s = raw as CareerState & { version?: number };
  if (s && s.version === 3) {
    const ready = {
      ...s,
      achievements: s.achievements ?? [],
      achievementsUnlockedAt: s.achievementsUnlockedAt ?? {},
      attrDeltas: s.attrDeltas ?? {},
    };
    setAttrDeltas(ready.attrDeltas);
    return ready;
  }
  const club = CLUBS[s.clubId];
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(s.players ?? {})) {
    players[id] = enrichPlayer(p as Player);
  }
  const base = defaultV3(club);
  return {
    ...s,
    version: 3,
    season: s.season ?? 1,
    training: s.training ?? "equilibrado",
    finances: s.finances ?? {
      budget: Math.round((club?.strength ?? 70) * 0.9 * 10) / 10,
      spent: 0,
      income: 0,
    },
    approval: s.approval ?? 62,
    objective:
      s.objective ?? Math.max(1, Math.min(15, Math.round((96 - (club?.strength ?? 70)) / 4))),
    news: s.news ?? [],
    trophies: s.trophies ?? [],
    history: s.history ?? [],
    players,
    fanApproval: s.fanApproval ?? base.fanApproval,
    pressure: s.pressure ?? base.pressure,
    staff: s.staff ?? base.staff,
    sponsor: s.sponsor ?? base.sponsor,
    ticketPrice: s.ticketPrice ?? base.ticketPrice,
    capacity: s.capacity ?? base.capacity,
    streak: s.streak ?? 0,
    offers: s.offers ?? [],
    jobOffers: s.jobOffers ?? [],
    scoutReports: s.scoutReports ?? [],
    sacked: s.sacked ?? false,
    managerHistory: s.managerHistory ?? [
      { clubId: s.clubId, from: s.season ?? 1, to: null, note: "Contratado" },
    ],
    achievements: s.achievements ?? [],
    achievementsUnlockedAt: s.achievementsUnlockedAt ?? {},
  };
}

export function orderedPositions(): Position[] {
  return ["GK", "DF", "MF", "FW"];
}

/** Contexto opcional do jogo: forma/moral (0–100) e cansaço dos dois lados. */
export type QuickSimContext = MatchConditions;

export type QuickSimEvent = FixtureEvent;

/**
 * Simulação rápida (sem 3D) para as outras partidas da rodada.
 * A diferença de força é comprimida (tanh) para evitar goleadas demais, e uma
 * correção de Dixon-Coles aproxima a frequência real de empates.
 */
export function quickSimulate(
  homeId: string,
  awayId: string,
  seed: string,
  ctx: QuickSimContext = {},
) {
  const rnd = makeRng(seed);
  const h = CLUBS[homeId]?.strength ?? 70;
  const a = CLUBS[awayId]?.strength ?? 70;
  const { hg, ag } = regulationScore(expectedGoals(h, a, seed, ctx), rnd);
  return { hg, ag, events: quickEvents(hg, ag, rnd) };
}

/** Use the saved squad for the managed club, including transfers and availability. */
export function careerMatchContext(
  state: CareerState,
  home: string,
  away: string,
): QuickSimContext {
  const ctx: QuickSimContext = {
    homeForm: recentForm(state.fixtures, home, state.round),
    awayForm: recentForm(state.fixtures, away, state.round),
    homeFatigue: squadFatigue(state.fixtures, home, state.round),
    awayFatigue: squadFatigue(state.fixtures, away, state.round),
  };
  if (home !== state.clubId && away !== state.clubId) return ctx;
  const squad = Object.values(state.players).filter((p) => p.clubId === state.clubId);
  let players = state.lineup
    .map((id) => state.players[id])
    .filter(
      (p): p is Player =>
        Boolean(p) && p!.clubId === state.clubId && !p!.suspended && p!.injuryWeeks === 0,
    );
  if (players.length < 11) {
    const { lineup } = pickLineup(squad, state.tactics.formation);
    players = lineup.map((id) => state.players[id]!).filter(Boolean);
  }
  const side = home === state.clubId ? "home" : "away";
  if (players.length) {
    const average = (read: (p: Player) => number) =>
      players.reduce((sum, p) => sum + read(p), 0) / players.length;
    // Club strength represents a normal XI at overall strength-2.
    ctx[`${side}Strength`] = average((p) => p.ovr) + 2 - Math.max(0, 11 - players.length) * 2;
    ctx[`${side}Form`] = ctx[`${side}Form`]! * 0.7 + average((p) => p.form ?? 60) * 0.3;
    ctx[`${side}Fatigue`] = average((p) => 100 - p.condition);
  }
  ctx[`${side}Tactics`] = state.tactics;
  return ctx;
}

/** Forma recente 0–100 pelos pontos nos últimos 5 jogos (60 = neutra). */
/**
 * Cansaço estimado (0–100) de um clube controlado pelo computador: o desgaste
 * cresce ao longo da temporada e cada expulsão nas duas últimas rodadas pesa
 * (elenco desfalcado roda menos). Determinístico, sem estado extra.
 */
export function squadFatigue(fixtures: Fixture[], clubId: string, beforeRound: number): number {
  const lastRound = fixtures.reduce((m, f) => Math.max(m, f.round), 1);
  let reds = 0;
  for (const f of fixtures) {
    if (f.round >= beforeRound || f.round < beforeRound - 2 || !f.events) continue;
    const side = f.home === clubId ? "home" : f.away === clubId ? "away" : null;
    if (!side) continue;
    reds += f.events.filter((e) => e.kind === "vermelho" && e.side === side).length;
  }
  return Math.min(100, 12 + 20 * (beforeRound / lastRound) + 12 * reds);
}

export function recentForm(fixtures: Fixture[], clubId: string, beforeRound: number): number {
  const last = fixtures
    .filter(
      (f) =>
        f.round < beforeRound && f.homeGoals !== null && (f.home === clubId || f.away === clubId),
    )
    .sort((a, b) => b.round - a.round)
    .slice(0, 5);
  if (!last.length) return 60;
  let pts = 0;
  for (const f of last) {
    const mine = f.home === clubId ? f.homeGoals! : f.awayGoals!;
    const theirs = f.home === clubId ? f.awayGoals! : f.homeGoals!;
    pts += mine > theirs ? 3 : mine === theirs ? 1 : 0;
  }
  return Math.round(20 + (pts / (last.length * 3)) * 80);
}

/** Minutos dos gols, pênaltis, gols contra e expulsões, com viradas plausíveis. */
function quickEvents(hg: number, ag: number, rnd: () => number): QuickSimEvent[] {
  const ev: QuickSimEvent[] = [];
  const minute = () => {
    // mais gols no fim de cada tempo
    const r = rnd();
    const m =
      r < 0.47
        ? 1 + Math.floor(Math.pow(rnd(), 0.8) * 45)
        : 46 + Math.floor(Math.pow(rnd(), 0.75) * 45);
    return Math.min(90, m);
  };
  const push = (side: "home" | "away", n: number) => {
    for (let i = 0; i < n; i++) {
      const r = rnd();
      ev.push({
        minute: minute(),
        side,
        kind: r < 0.1 ? "penalti" : r < 0.13 ? "gol_contra" : "gol",
      });
    }
  };
  push("home", hg);
  push("away", ag);
  if (rnd() < 0.12)
    ev.push({
      minute: 30 + Math.floor(rnd() * 60),
      side: rnd() < 0.55 ? "away" : "home",
      kind: "vermelho",
    });
  return ev.sort((x, y) => x.minute - y.minute);
}

function totalRounds(state: CareerState): number {
  return state.fixtures.reduce((m, f) => Math.max(m, f.round), 0);
}

/* ------------------------------------------------------------ mecânicas */

function trainingAttr(focus: TrainingFocus): keyof Player {
  switch (focus) {
    case "ataque":
      return "shooting";
    case "defesa":
      return "defending";
    case "fisico":
      return "physical";
    case "tecnica":
      return "passing";
    default:
      return "pace";
  }
}

function applyWeeklyDevelopment(
  players: Record<string, Player>,
  state: CareerState,
  won: boolean | null,
  seed: string,
  livePids: Set<string> = new Set(),
  matchPlayed = true,
): { players: Record<string, Player>; news: NewsItem[] } {
  const rnd = makeRng(seed);
  const news: NewsItem[] = [];
  const attr = trainingAttr(state.training);
  const intensity = state.trainingIntensity ?? 1;
  const baseRegen = state.training === "fisico" ? 16 : state.training === "equilibrado" ? 12 : 9;
  // treino leve recupera mais e evolui menos; treino intenso é o contrário
  // Impulso semanal comprado na loja: +25% de treino e +5 de recuperação.
  const boosted = !!state.boostUntil && new Date(state.boostUntil).getTime() > Date.now();
  const condRegen =
    baseRegen + (intensity === 0 ? 5 : intensity === 2 ? -5 : 0) + (boosted ? 5 : 0);
  const growthMult = (0.75 + intensity * 0.3) * (boosted ? 1.25 : 1);
  const injuryMult = 0.7 + intensity * 0.4;

  const next: Record<string, Player> = {};
  for (const [id, p] of Object.entries(players)) {
    const q = { ...p };

    // recuperação de lesão e suspensão cumprida
    if (q.injuryWeeks > 0) {
      q.injuryWeeks = Math.max(0, q.injuryWeeks - 1);
      if (q.injuryWeeks === 0) {
        news.push({
          id: `heal-${id}-${state.round}`,
          season: state.season,
          round: state.round,
          kind: "lesao",
          title: `${q.name} recuperado`,
          body: `${q.name} está liberado pelo departamento médico e volta aos treinos.`,
        });
      }
    }
    if (q.suspended) q.suspended = false;

    // condição e moral
    q.condition = Math.max(45, Math.min(100, q.condition + condRegen - 4 + Math.floor(rnd() * 6)));
    q.morale = Math.max(
      30,
      Math.min(99, q.morale + (won === null ? 0 : won ? 3 : -2) + Math.floor(rnd() * 5) - 2),
    );

    // desenvolvimento por idade
    if (q.age <= 23 && rnd() < 0.16 * growthMult) {
      (q as unknown as Record<string, number>)[attr] = Math.min(99, (q[attr] as number) + 1);
      if (rnd() < 0.35) {
        q.ovr = Math.min(99, q.ovr + 1);
        news.push({
          id: `grow-${id}-${state.round}`,
          season: state.season,
          round: state.round,
          kind: "sistema",
          title: `${q.name} evolui para ${q.ovr}`,
          body: `O jovem talento respondeu bem ao treino focado em ${state.training}.`,
        });
      }
    } else if (q.age >= 33 && rnd() < 0.1) {
      q.ovr = Math.max(50, q.ovr - 1);
    }

    // cartões e lesões da rodada (somente quem jogou; ao vivo já trouxe os dados)
    const played = state.lineup.includes(id) || state.bench.slice(0, 3).includes(id);
    const fromLive = livePids.has(id);
    if (matchPlayed && played && !fromLive) {
      if (rnd() < 0.11) {
        q.yellows += 1;
        if (q.yellows >= 3) {
          q.yellows = 0;
          q.suspended = true;
          news.push({
            id: `susp-${id}-${state.round}`,
            season: state.season,
            round: state.round,
            kind: "cartao",
            title: `${q.name} suspenso`,
            body: `Terceiro cartão amarelo: ${q.name} desfalca o time na próxima rodada.`,
          });
        }
      }
      if (rnd() < 0.045 * injuryMult) {
        q.injuryWeeks = 1 + Math.floor(rnd() * 4);
        news.push({
          id: `inj-${id}-${state.round}`,
          season: state.season,
          round: state.round,
          kind: "lesao",
          title: `${q.name} se lesiona`,
          body: `${q.name} será desfalque por aproximadamente ${q.injuryWeeks} rodada(s).`,
        });
      }
    }
    // desgaste físico vale para todo mundo que jogou, inclusive ao vivo
    if (played) {
      q.condition = Math.max(40, q.condition - 8 - Math.floor(rnd() * 8));
    }

    q.value = valueFor(q.ovr, q.age);
    next[id] = q;
  }
  return { players: next, news };
}

function endSeason(state: CareerState): CareerState {
  // As copas precisam ter campeão mesmo depois da eliminação do treinador ou em ligas curtas.
  for (let step = 0; step < 16 && (state.cups ?? []).some((c) => !c.winner); step++)
    state = processCups(state, state.round, true);
  const club = CLUBS[state.clubId]!;
  const table = computeTable(state);
  const tables = seasonTables(state, table);
  const regional = regionalFinals(state, tables);
  const closingCups = [...(state.cups ?? []), ...regional.cups];
  const position = table.findIndex((r) => r.clubId === state.clubId) + 1;
  const row = table[position - 1]!;
  const championId =
    regional.cups.find((c) => c.competitionId === `regional:${state.leagueId}`)?.winner ??
    table[0]!.clubId;
  const champion = CLUBS[championId]!;
  const league = getLeague(state.leagueId);

  const prize = seasonPrize(position, club.strength);
  const metObjective = position <= state.objective;
  const approval = Math.max(
    5,
    Math.min(100, state.approval + (metObjective ? 18 : -14) + (position === 1 ? 10 : 0)),
  );

  const news: NewsItem[] = [
    {
      id: `season-end-${state.season}`,
      season: state.season,
      round: state.round,
      kind: "premio",
      title: `Fim da temporada ${state.season}: ${position}º lugar`,
      body: `${champion.name} conquistou a ${league.name}. Premiação de €${prize}M. ${metObjective ? "A diretoria aprova o trabalho!" : "A diretoria esperava mais..."}`,
    },
  ];
  if (championId === state.clubId) {
    news.push({
      id: `champion-${state.season}`,
      season: state.season,
      round: state.round,
      kind: "premio",
      title: `🏆 ${club.name} é CAMPEÃO!`,
      body: `Temporada histórica! O título da ${league.name} veio na temporada ${state.season}.`,
    });
  }

  // envelhecimento e reset de estatísticas
  const rnd = makeRng(`age-${state.clubId}-${state.season}`);
  const aged: Record<string, Player> = {};
  for (const [id, p] of Object.entries(state.players)) {
    aged[id] = {
      ...p,
      age: p.age + 1,
      goals: 0,
      assists: 0,
      apps: 0,
      yellows: 0,
      suspended: false,
      condition: 88 + Math.floor(rnd() * 10),
      morale: Math.max(45, Math.min(90, p.morale)),
    };
  }

  // aposentadorias e garotos da base
  const regen = applyRegens(aged, state.clubId, state.season, state.round);
  const players = regen.players;
  news.push(...regen.news);

  const squad = Object.values(players);
  const { lineup, bench } = pickLineup(squad, state.tactics.formation);

  // Evolução dos 28 atributos: fica guardada na carreira e vale para sempre.
  const attrDeltas = evolveSeason(squad, state.season, state.attrDeltas ?? {});
  setAttrDeltas(attrDeltas);

  // acesso e rebaixamento entre as divisões do país
  const pyramidLeague = REGIONAL_LINKS[state.leagueId]
    ? topLeague(getLeague(state.leagueId).country)!.id
    : state.leagueId;
  const movement = applyPyramid(
    { ...state, leagueId: pyramidLeague },
    tables[pyramidLeague] ?? table,
    state.pyramidSlots,
    tables,
  );
  const move =
    movement && pyramidLeague !== state.leagueId && !movement.moved
      ? { ...movement, leagueId: state.leagueId }
      : movement;
  const nationalComposition = { ...(state.leagueClubs ?? {}), ...move?.leagueClubs };
  const qualifications = resolveQualifications(state, tables, closingCups, nationalComposition);
  const admission =
    getLeague(state.leagueId).country === "Brasil"
      ? applyRegionalEntries(
          { ...state, leagueId: move?.leagueId ?? state.leagueId },
          nationalComposition,
          qualifications,
          tables,
        )
      : null;
  const competitionRecord = seasonCompetitionRecord(
    state,
    tables,
    closingCups,
    move,
    regional.playoffs,
  );

  // Checagem de integridade da temporada que terminou. Não bloqueia a carreira:
  // registra no noticiário para que qualquer inconsistência fique visível.
  const issues = checkSeasonIntegrity({
    clubIds: leagueClubIds(state),
    fixtures: state.fixtures,
    table,
    ...(state.leagueId === "x5686" &&
    state.fixtures.length === (table.length * (table.length - 1)) / 2
      ? { expectedGamesPerClub: table.length - 1 }
      : {}),
  });
  if (issues.length) {
    console.warn("[season-integrity]", state.season, issues);
    news.push({
      id: `integrity-${state.season}`,
      season: state.season,
      round: state.round,
      kind: "sistema",
      title: "Relatório de integridade da temporada",
      body: `Foram encontradas ${issues.length} inconsistência(s) e a temporada foi fechada com a tabela oficial. Ex.: ${issues[0]}`,
    });
  }
  const nextLeagueId = admission?.leagueId ?? move?.leagueId ?? state.leagueId;
  const nextLeagueClubs = updatedSeasonComposition(
    state,
    admission?.leagueClubs ?? (move ? nationalComposition : state.leagueClubs),
    nextLeagueId,
    [...(move?.promoted ?? []), ...(move?.relegated ?? [])],
  );
  for (const entry of qualifications.filter((e) => e.clubId === state.clubId))
    news.push({
      id: `qualification-${state.season}-${entry.competitionId}`,
      season: state.season,
      round: state.round,
      kind: "sistema",
      title: `Vaga conquistada: ${entry.name}`,
      body: `${entry.reason}. Inscrição na próxima temporada (${entry.phase === "preliminar" ? "fase preliminar" : "fase principal"}).`,
    });
  if (move) {
    for (const change of move.movements) {
      const upper = getLeague(change.to).name;
      const lower = getLeague(change.from).name;
      news.push({
        id: `pyramid-${state.season}-${change.from}-${change.to}`,
        season: state.season,
        round: state.round,
        kind: "sistema",
        title: `Subiram / Caíram · ${upper} ↔ ${lower}`,
        body: `Subiram: ${change.promoted.map((id) => CLUBS[id]?.name ?? id).join(", ")}. Caíram: ${change.relegated.map((id) => CLUBS[id]?.name ?? id).join(", ")}.`,
      });
    }
  }
  if (move?.moved) {
    const up = move.moved === "subiu";
    news.push({
      id: `${move.moved}-${state.season}`,
      season: state.season,
      round: state.round,
      kind: "premio",
      title: up ? `⬆️ ${club.name} conquista o acesso!` : `⬇️ ${club.name} é rebaixado`,
      body: up
        ? `Com o ${position}º lugar, o clube sobe para a ${getLeague(move.leagueId).name} na próxima temporada.`
        : `O ${position}º lugar levou o clube para a ${getLeague(move.leagueId).name} na próxima temporada.`,
    });
  }

  return {
    ...state,
    season: state.season + 1,
    calendarYear: calendarYear(state) + 1,
    competitionHistory: [...(state.competitionHistory ?? []), competitionRecord].slice(-4),
    qualifications,
    ...(regional.cups.some((c) => c.competitionId === `regional:${state.leagueId}`)
      ? { regionalLeagueId: state.leagueId }
      : {}),
    round: 1,
    records: {
      ...(state.records ?? {}),
      promotions: (state.records?.promotions ?? 0) + (move?.moved === "subiu" ? 1 : 0),
      relegations: (state.records?.relegations ?? 0) + (move?.moved === "desceu" ? 1 : 0),
    },
    leagueId: nextLeagueId,
    catalogCalendarPending: false,
    ...(nextLeagueClubs ? { leagueClubs: nextLeagueClubs } : {}),
    fixtures: generateFixtures(
      nextLeagueId,
      `${state.clubId}-${state.managerName}-s${state.season + 1}`,
      nextLeagueClubs?.[nextLeagueId],
    ),
    players,
    attrDeltas,
    lineup,
    bench,
    results: [],
    cups: [],
    finances: {
      budget: Math.round((state.finances.budget + prize) * 10) / 10,
      spent: 0,
      income: 0,
    },
    approval,
    trophies:
      championId === state.clubId
        ? [...state.trophies, { season: state.season, name: league.name }]
        : state.trophies,
    history: [
      ...state.history,
      {
        season: state.season,
        position,
        pts: row.pts,
        w: row.w,
        d: row.d,
        l: row.l,
        championId,
      },
    ],
    news: [...news.reverse(), ...state.news].slice(0, 60),
  };
}

/** Desempenho individual de uma partida (jogadores do clube do usuário). */
export interface MatchPerformance {
  pid: string;
  goals: number;
  assists: number;
  played: boolean;
  /** minutos em campo (padrão 90 quando ausente) */
  minutes?: number;
  /** nota da partida 0-10 */
  rating?: number;
  /** amarelos na partida ao vivo (acumulam para suspensão) */
  yellow?: number;
  /** expulso na partida ao vivo (suspenso na próxima) */
  red?: boolean;
  /** semanas de lesão diagnosticadas no lance */
  injuryWeeks?: number;
}

export function advanceRound(
  state: CareerState,
  userResult: { hg: number; ag: number } | null,
  performances: MatchPerformance[] = [],
  comp = "Liga",
) {
  const round = state.round;
  const played = state.fixtures.find(
    (f) => f.round === round && (f.home === state.clubId || f.away === state.clubId),
  );
  if (played && !userResult) throw new Error("O resultado da partida do clube é obrigatório.");
  const matchResult = played ? userResult : null;
  const fixtures = state.fixtures.map((f) => {
    if (f.round !== round || f.homeGoals !== null) return f;
    if (f.home === state.clubId || f.away === state.clubId) {
      return matchResult ? { ...f, homeGoals: matchResult.hg, awayGoals: matchResult.ag } : f;
    }
    const { hg, ag, events } = quickSimulate(
      f.home,
      f.away,
      `${state.clubId}-${state.season}-${round}-${f.home}`,
      careerMatchContext(state, f.home, f.away),
    );
    return { ...f, homeGoals: hg, awayGoals: ag, events };
  });

  const userHome = played ? played.home === state.clubId : true;
  const gf = matchResult ? (userHome ? matchResult.hg : matchResult.ag) : 0;
  const ga = matchResult ? (userHome ? matchResult.ag : matchResult.hg) : 0;
  const won = matchResult !== null && gf > ga;
  const draw = matchResult !== null && gf === ga;

  // estatísticas individuais da partida (jogos, gols, assistências, cartões, lesões)
  let squadAfterMatch = state.players;
  const liveNews: NewsItem[] = [];
  if (performances.length) {
    squadAfterMatch = { ...state.players };
    for (const perf of performances) {
      const p = squadAfterMatch[perf.pid];
      if (!p) continue;
      const q = {
        ...p,
        apps: (p.apps ?? 0) + (perf.played ? 1 : 0),
        goals: (p.goals ?? 0) + perf.goals,
        assists: (p.assists ?? 0) + perf.assists,
        yellows: (p.yellows ?? 0) + (perf.yellow ?? 0),
        suspended: p.suspended,
        injuryWeeks: Math.max(p.injuryWeeks ?? 0, perf.injuryWeeks ?? 0),
      };
      // vermelho direto suspende; 3 amarelos acumulados também
      if (perf.red) {
        q.suspended = true;
        liveNews.push({
          id: `sentoff-${perf.pid}-${round}`,
          season: state.season,
          round,
          kind: "cartao",
          title: `${q.name} expulso`,
          body: `${q.name} foi expulso e desfalca o time na próxima rodada.`,
        });
      } else if (q.yellows >= 3) {
        q.yellows = 0;
        q.suspended = true;
        liveNews.push({
          id: `susp-${perf.pid}-${round}`,
          season: state.season,
          round,
          kind: "cartao",
          title: `${q.name} suspenso`,
          body: `Terceiro cartão amarelo: ${q.name} desfalca o time na próxima rodada.`,
        });
      }
      if ((perf.injuryWeeks ?? 0) > 0 && (p.injuryWeeks ?? 0) === 0) {
        liveNews.push({
          id: `inj-${perf.pid}-${round}`,
          season: state.season,
          round,
          kind: "lesao",
          title: `${q.name} se lesiona`,
          body: `${q.name} será desfalque por aproximadamente ${perf.injuryWeeks} rodada(s).`,
        });
      }
      squadAfterMatch[perf.pid] = q;
    }
  }

  // mecânicas semanais sobre o elenco (quem tem dado ao vivo não entra no sorteio)
  const livePids = new Set(performances.map((p) => p.pid));
  const { players, news } = applyWeeklyDevelopment(
    squadAfterMatch,
    state,
    matchResult ? won : null,
    `${state.clubId}-${round}-dev`,
    livePids,
    matchResult !== null,
  );
  news.unshift(...liveNews);

  // finanças semanais
  const table = computeTable({ ...state, fixtures });
  const position = table.findIndex((r) => r.clubId === state.clubId) + 1;
  const homeGame = played ? played.home === state.clubId : false;
  const gate = homeGame ? gateIncome(state) : 0;
  const income =
    weeklyIncome(CLUBS[state.clubId]?.strength ?? 70, position || 10, won) +
    (state.sponsor ?? 0) +
    gate;
  const wages = Object.values(players).reduce((s, p) => s + p.wage, 0) / 1000;
  const costs = wages + staffBill(state);
  const budget = Math.round((state.finances.budget + income - costs) * 100) / 100;

  // aprovação da diretoria e da torcida
  const approval = matchResult
    ? Math.max(5, Math.min(100, state.approval + (won ? 2.5 : draw ? 0.5 : -2.5)))
    : state.approval;
  const fanApproval = matchResult
    ? Math.max(
        5,
        Math.min(
          100,
          (state.fanApproval ?? 60) + (won ? 3 : draw ? 0 : -3) - (state.ticketPrice - 45) / 25,
        ),
      )
    : state.fanApproval;
  const pressure = matchResult
    ? Math.max(
        0,
        Math.min(
          100,
          (state.pressure ?? 25) + pressureDelta(won, draw, position || 10, state.objective),
        ),
      )
    : state.pressure;
  const streak = !matchResult
    ? (state.streak ?? 0)
    : won
      ? Math.max(1, (state.streak ?? 0) + 1)
      : draw
        ? 0
        : Math.min(-1, (state.streak ?? 0) - 1);

  const headline: NewsItem | null = matchResult
    ? {
        id: `res-${round}-${state.season}`,
        season: state.season,
        round,
        kind: "resultado",
        title: won
          ? `Vitória por ${gf}x${ga}!`
          : draw
            ? `Empate em ${gf}x${ga}`
            : `Derrota por ${gf}x${ga}`,
        body: played
          ? `${CLUBS[played.home]?.name} ${matchResult.hg} x ${matchResult.ag} ${CLUBS[played.away]?.name} — Rodada ${round}.`
          : "",
      }
    : null;

  // histórico partida a partida
  const logEntry =
    played && matchResult
      ? {
          season: state.season,
          round,
          clubId: state.clubId,
          comp,
          opponentId: played.home === state.clubId ? played.away : played.home,
          home: userHome,
          gf,
          ga,
          players: performances.map((p) => ({
            pid: p.pid,
            goals: p.goals,
            assists: p.assists,
            minutes: p.minutes ?? 90,
            rating: Math.round((p.rating ?? 6 + p.goals * 1.2 + p.assists * 0.7) * 10) / 10,
          })),
        }
      : null;

  let next: CareerState = {
    ...state,
    fixtures,
    players,
    round: round + 1,
    ...(logEntry ? { matchLog: [logEntry, ...(state.matchLog ?? [])].slice(0, 400) } : {}),
    results:
      played && matchResult
        ? [
            ...state.results,
            { round, home: played.home, away: played.away, hg: matchResult.hg, ag: matchResult.ag },
          ]
        : state.results,
    finances: {
      budget,
      spent: state.finances.spent,
      income: Math.round((state.finances.income + income) * 100) / 100,
    },
    approval: Math.round(approval),
    fanApproval: Math.round(fanApproval),
    pressure: Math.round(pressure),
    streak,
    news: [...(headline ? [headline] : []), ...news, ...state.news].slice(0, 60),
  };

  // eventos dinâmicos: bastidores, propostas por jogadores, sondagens por você
  const ev = runWeeklyEvents(next);
  next = {
    ...next,
    players: ev.players,
    offers: [...(next.offers ?? []).filter((o) => o.expiresRound >= next.round), ...ev.offers],
    jobOffers: [
      ...(next.jobOffers ?? []).filter((j) => j.expiresRound >= next.round),
      ...ev.jobOffers,
    ],
    news: [...ev.news, ...next.news].slice(0, 60),
  };

  // copas: fases intercaladas com o calendário da liga
  next = processCups(next, round);

  if (next.round > totalRounds(next)) {
    next = endSeason(next);
  }

  next = recordWorldTransition(state, next);
  if (matchResult || next.season !== state.season) next = checkSacking(next);

  const newlyUnlocked = evaluateAchievements(next);
  if (newlyUnlocked.length) {
    const now = new Date().toISOString();
    next = {
      ...next,
      achievements: [...(next.achievements ?? []), ...newlyUnlocked],
      achievementsUnlockedAt: {
        ...(next.achievementsUnlockedAt ?? {}),
        ...Object.fromEntries(newlyUnlocked.map((id) => [id, now])),
      },
    };
  }

  return next;
}

/** Roda as fases de copa que caem nesta rodada. */
function processCups(state: CareerState, round: number, finish = false): CareerState {
  const country = getLeague(state.leagueId).country;
  const confed = countryRegulation(country).confederation;
  const cups: CupState[] = (state.cups?.length ? state.cups : createCups(state)).map((c) =>
    c.competitionId
      ? c
      : {
          ...c,
          entered: true,
          competitionId:
            c.id === "national"
              ? `national:${country}`
              : c.id === "continental"
                ? `continental:${confed}`
                : `world:${c.id}`,
        },
  );
  const news: NewsItem[] = [];
  const trophies = [...state.trophies];
  let budget = state.finances.budget;
  let income = state.finances.income;

  const updated = cups.map((cup) => {
    if (cup.winner || (!finish && round % cup.everyRounds !== 0)) return cup;
    const wasGroupStage = inGroupStage(cup);
    const res = playCupStage(cup, state);
    if (res.userPlayed) {
      const opp = res.opponentId ? CLUBS[res.opponentId]?.name : "adversário";
      const newsId = `cup-${cup.id}-${state.season}-${wasGroupStage ? `g${cup.groupRound ?? 0}` : cup.stage}`;
      if (wasGroupStage) {
        // Na fase de grupos um tropeço não elimina: só a classificação final decide.
        news.push({
          id: newsId,
          season: state.season,
          round,
          kind: "resultado",
          title: `${cup.name}: ${res.userScore} contra ${opp}`,
          body: res.cup.out
            ? `Fim de caminhada ainda na fase de grupos.`
            : `${nextPhaseName(res.cup)} pela frente.`,
        });
      } else if (res.userWon) {
        const prize = cupPrize(cup.id, cup.stage);
        budget = Math.round((budget + prize) * 10) / 10;
        income = Math.round((income + prize) * 10) / 10;
        news.push({
          id: newsId,
          season: state.season,
          round,
          kind: "premio",
          title: `${cup.name}: classificado! (${res.userScore} contra ${opp})`,
          body: `Avanço garantido — ${stageName(res.cup.stage)} pela frente. Premiação de €${prize}M.`,
        });
      } else {
        news.push({
          id: newsId,
          season: state.season,
          round,
          kind: "resultado",
          title: `${cup.name}: eliminado (${res.userScore} contra ${opp})`,
          body: `Fim de caminhada na ${stageName(cup.stage)}.`,
        });
      }
    }
    if (res.champion === state.clubId) {
      trophies.push({ season: state.season, name: res.cup.name });
      const prize = cupPrize(cup.id, 4);
      budget = Math.round((budget + prize) * 10) / 10;
      income = Math.round((income + prize) * 10) / 10;
      news.push({
        id: `cup-win-${cup.id}-${state.season}`,
        season: state.season,
        round,
        kind: "premio",
        title: `🏆 Campeão da ${res.cup.name}!`,
        body: `Título conquistado na temporada ${state.season}. Premiação de €${prize}M.`,
      });
    }
    return res.cup;
  });

  return {
    ...state,
    cups: updated,
    trophies,
    finances: { ...state.finances, budget, income },
    news: [...news, ...state.news].slice(0, 60),
  };
}

/* ------------------------------------------------- diretoria & mercado */

/** Aceita uma proposta por um dos seus jogadores. */
export function acceptOffer(state: CareerState, offerId: string): CareerState {
  const offer = (state.offers ?? []).find((o) => o.id === offerId);
  if (!offer) return state;
  const player = state.players[offer.playerId];
  if (!player) return state;
  const players = { ...state.players };
  delete players[offer.playerId];
  const club = CLUBS[offer.clubId];

  return {
    ...state,
    players,
    lineup: state.lineup.filter((id) => id !== offer.playerId),
    bench: state.bench.filter((id) => id !== offer.playerId),
    offers: (state.offers ?? []).filter((o) => o.id !== offerId),
    finances: {
      ...state.finances,
      budget: Math.round((state.finances.budget + offer.amount) * 10) / 10,
      income: Math.round((state.finances.income + offer.amount) * 10) / 10,
    },
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
  if (!job) return state;
  const club = CLUBS[job.clubId]!;
  const squad = withCustomPlayers(job.clubId, withRealPlayers(job.clubId, buildSquad(job.clubId)));
  const { lineup, bench } = pickLineup(squad, state.tactics.formation);
  const history = state.sacked ? (state.managerHistory ?? []) : closeSpell(state, "Saiu do clube");

  return {
    ...state,
    leagueId: job.leagueId,
    clubId: job.clubId,
    round: 1,
    fixtures: generateFixtures(job.leagueId, `${job.clubId}-${state.managerName}-s${state.season}`),
    players: Object.fromEntries(squad.map((p) => [p.id, p])),
    lineup,
    bench,
    results: [],
    cups: [],
    finances: { budget: job.budget, spent: 0, income: 0 },
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

function pickRandomClubId(rnd: () => number, exclude: string): string {
  const ids = Object.keys(CLUBS).filter((id) => id !== exclude);
  return ids[Math.floor(rnd() * ids.length)] ?? exclude;
}

/** Melhora um membro do staff (custo imediato em M€). */
export function upgradeStaff(
  state: CareerState,
  role: keyof ReturnType<typeof defaultStaff>,
): CareerState {
  const staff = state.staff ?? defaultStaff();
  const level = staff[role];
  if (level >= 5) return state;
  const cost = Math.round((level + 1) * 1.2 * 10) / 10;
  if (state.finances.budget < cost) return state;
  return {
    ...state,
    staff: { ...staff, [role]: level + 1 },
    finances: {
      ...state.finances,
      budget: Math.round((state.finances.budget - cost) * 10) / 10,
      spent: Math.round((state.finances.spent + cost) * 10) / 10,
    },
  };
}

/** Gera relatórios de olheiros conforme o nível do departamento. */
export function runScouting(state: CareerState): CareerState {
  const level = (state.staff ?? defaultStaff()).olheiro;
  const rnd = makeRng(`scout-${state.clubId}-${state.season}-${state.round}`);
  const ids = Object.keys(CLUBS).filter((id) => id !== state.clubId);
  const reports: ScoutReport[] = [];
  for (let i = 0; i < 3 + level; i++) {
    const clubId = ids[Math.floor(rnd() * ids.length)]!;
    const squad = buildSquad(clubId).map(enrichPlayer);
    const p = squad[Math.floor(rnd() * squad.length)];
    if (!p) continue;
    reports.push({
      id: `sc-${p.id}-${state.season}-${state.round}-${i}`,
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
  return { ...state, scoutReports: reports };
}
