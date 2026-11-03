import { CLUBS, getLeague } from "./data/leagues";
import { migrateSquadRatings } from "./squad-rating-migration";
import { repairCareer } from "./career-repair";
import { withCareerWorld } from "./career-world";
import { developedPlayer, withDevelopmentBase } from "./attributes";
import { generateFixtures } from "./season";
import { completeSquad } from "./squad";
import type { CareerState, Player } from "./types";
import { defaultV3, enrichPlayer } from "./career";

/** Migra estados antigos (v1/v2) para o formato atual. */
export function migrateCareer(raw: unknown): CareerState {
  const { state: restored, fixes } = repairCareer(migrateCareerShape(raw));
  const repaired = migrateSquadRatings(restored);
  const catalogState = upgradeCatalog(repaired);
  const state = withCareerWorld({
    ...catalogState,
    players: Object.fromEntries(
      Object.entries(catalogState.players).map(([id, p]) => [
        id,
        developedPlayer(
          withDevelopmentBase(p, catalogState.developmentRulesVersion === 2 ? 2 : 1),
          catalogState,
        ),
      ]),
    ),
  });
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

export function upgradeCatalog(state: CareerState): CareerState {
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

export function migrateCareerShape(raw: unknown): CareerState {
  const s = raw as CareerState & { version?: number };
  if (s && s.version === 3) {
    const ready = {
      ...s,
      achievements: s.achievements ?? [],
      achievementsUnlockedAt: s.achievementsUnlockedAt ?? {},
      attrDeltas: s.attrDeltas ?? {},
    };
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
