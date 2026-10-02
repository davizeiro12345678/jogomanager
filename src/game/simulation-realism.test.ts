import { describe, expect, it } from "vitest";
import {
  buildReadySquad,
  careerMatchContext,
  initCareer,
  migrateCareer,
  pickLineup,
  quickSimulate,
} from "./career";
import { autoWeek } from "./autoplay";
import { CLUBS } from "./data/leagues";
import { competitionScore } from "./competition-match";
import { expectedGoals } from "./match-probability";
import { matchAttributes } from "./match-readiness";
import { buildTeamSetup } from "./quickMatch";
import { buildLegacySquad, buildSquad, completeSquad } from "./squad";
import { migrateSquadRatings } from "./squad-rating-migration";
import { shotProbabilities } from "./sim-rules";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  MatchSim,
} from "./sim";
import type { CareerState, Player } from "./types";

const mean = (players: Player[]) => players.reduce((sum, p) => sum + p.ovr, 0) / players.length;

describe("club ratings and saved squads", () => {
  it("rates Fluminense above Botafogo and Atlético in both the catalog and starting XI", () => {
    for (const id of ["bot", "mgo"]) {
      expect(CLUBS["flu"]!.strength).toBeGreaterThan(CLUBS[id]!.strength);
      expect(mean(buildTeamSetup("flu").players)).toBeGreaterThan(mean(buildTeamSetup(id).players));
    }
    for (const id of ["flu", "bot", "mgo", "fla", "pal", "bah", "cru", "vit", "ath", "ath_b"]) {
      expect(Math.abs(mean(buildTeamSetup(id).players) - (CLUBS[id]!.strength - 2))).toBeLessThan(
        1,
      );
    }
  });
  it("assigns Bilbao's named roster to Bilbao, never Athletico Paranaense", () => {
    expect(buildSquad("ath_b").some((p) => p.name === "Nico Williams")).toBe(true);
    expect(buildSquad("ath").some((p) => p.name === "Nico Williams" || p.name === "Simón")).toBe(
      false,
    );
  });
  it("does not inflate every low-level club to a minimum of 58", () => {
    const club = Object.values(CLUBS).find((c) => c.strength < 50)!;
    expect(club).toBeDefined();
    expect(mean(buildTeamSetup(club.id).players)).toBeLessThan(52);
  });
  it("recalibrates only unchanged original players, once, without rewriting history or development", () => {
    const originals = buildLegacySquad("flu");
    const changed = { ...originals[1]!, passing: originals[1]!.passing + 1, apps: 40 };
    const imported = { ...originals[2]!, rosterSource: "imported" as const };
    const custom = { ...originals[3]!, rosterSource: "custom" as const };
    const transferred = { ...originals[4]!, clubId: "pal" };
    const evolved = { ...originals[5]!, ovr: originals[5]!.ovr + 2 };
    const squad = [
      originals[0]!,
      changed,
      imported,
      custom,
      transferred,
      evolved,
      ...originals.slice(6),
    ];
    const state = {
      clubId: "flu",
      season: 3,
      round: 8,
      news: [],
      players: Object.fromEntries(squad.map((p) => [p.id, p])),
      results: [{ round: 1, home: "flu", away: "bot", hg: 1, ag: 0 }],
      finances: { budget: 25 },
    } as unknown as CareerState;
    const before = structuredClone(state);
    const next = migrateSquadRatings(state);
    expect(next.players[originals[0]!.id]!.ovr).toBe(buildSquad("flu")[0]!.ovr);
    for (const p of [changed, imported, custom, transferred, evolved])
      expect(next.players[p.id]).toEqual(p);
    expect(next.results).toEqual(before.results);
    expect(next.finances).toEqual(before.finances);
    expect(state).toEqual(before);
    expect(migrateSquadRatings(next)).toBe(next);
    expect(completeSquad("flu", [custom])[0]).toBe(custom);
  });
  it("applies the rating migration through the real career loader", () => {
    const initial = initCareer("bra", "flu", "Davi");
    const legacy = buildLegacySquad("flu");
    const { simulationRatingRevision: _, ...save } = initial;
    const loaded = migrateCareer({
      ...save,
      players: Object.fromEntries(legacy.map((p) => [p.id, p])),
    });
    expect(loaded.simulationRatingRevision).toBe(1);
    expect(loaded.players[legacy[0]!.id]!.ovr).toBeGreaterThan(legacy[0]!.ovr);
    expect(loaded.lineup).toEqual(initial.lineup);
  });
});

describe("match conditions and probability", () => {
  it("lets the stronger club remain favorite while weaker clubs win and draw in both venues", () => {
    for (const [home, away, weakHome] of [
      ["vit", "fla", true],
      ["fla", "vit", false],
    ] as const) {
      let wins = 0,
        draws = 0,
        losses = 0;
      for (let i = 0; i < 4000; i++) {
        const r = quickSimulate(home, away, `upset-${i}`);
        const weak = weakHome ? r.hg : r.ag,
          strong = weakHome ? r.ag : r.hg;
        if (weak > strong) wins++;
        else if (weak === strong) draws++;
        else losses++;
      }
      expect(wins / 4000).toBeGreaterThan(0.1);
      expect(wins / 4000).toBeLessThan(0.4);
      expect(losses).toBeGreaterThan(wins);
      expect(draws / 4000).toBeGreaterThan(0.18);
    }
  });
  it("uses the same regulation score in league, continental and cup simulations", () => {
    for (let i = 0; i < 200; i++) {
      const quick = quickSimulate("flu", "bot", `shared-${i}`);
      expect(competitionScore("flu", "bot", `shared-${i}`)).toEqual({ hg: quick.hg, ag: quick.ag });
    }
  });
  it("limits bad input and never gives neutral venues a home advantage", () => {
    for (const seed of ["neutral-a", "neutral-b"]) {
      const neutral = expectedGoals(80, 80, seed, { neutralVenue: true });
      const regular = expectedGoals(80, 80, seed);
      expect(regular.home).toBeGreaterThan(neutral.home);
      expect(regular.away).toBeLessThan(neutral.away);
    }
    const score = quickSimulate("flu", "bot", "invalid", {
      homeStrength: NaN,
      awayFatigue: Infinity,
      homeForm: -900,
      awayForm: 999,
    });
    expect(Number.isFinite(score.hg + score.ag)).toBe(true);
  });
  it("takes transfers, injuries, fatigue and tactics from the actual saved squad in autoplay", () => {
    const state = initCareer("bra", "flu", "Davi");
    const fixture = state.fixtures.find(
      (f) => f.round === state.round && (f.home === state.clubId || f.away === state.clubId),
    )!;
    const first = careerMatchContext(state, fixture.home, fixture.away);
    const weaker = {
      ...state,
      players: Object.fromEntries(
        Object.values(state.players).map((p) => [
          p.id,
          { ...p, ovr: p.ovr - 15, condition: 45, form: 25 },
        ]),
      ),
    };
    const side = fixture.home === state.clubId ? "home" : "away";
    const next = careerMatchContext(weaker, fixture.home, fixture.away);
    expect(next[`${side}Strength`]!).toBeLessThan(first[`${side}Strength`]! - 10);
    expect(next[`${side}Fatigue`]!).toBeGreaterThan(first[`${side}Fatigue`]!);
    const expected = quickSimulate(
      fixture.home,
      fixture.away,
      `${state.clubId}-auto-${state.season}-${state.round}`,
      first,
    );
    const result = autoWeek(state)!;
    expect(result.gf).toBe(side === "home" ? expected.hg : expected.ag);
    expect(result.ga).toBe(side === "home" ? expected.ag : expected.hg);
  });
  it("selects a fit reserve instead of an exhausted star", () => {
    const squad = buildReadySquad("flu");
    const defender = squad.find((p) => p.pos === "DF")!;
    const exhausted = { ...defender, id: "tired-star", ovr: 85, condition: 25 };
    const fit = { ...defender, id: "fit-reserve", ovr: 82, condition: 100 };
    const line = pickLineup([...squad, exhausted, fit], "4-3-3").lineup;
    expect(line).toContain(fit.id);
    expect(line).not.toContain(exhausted.id);
  });
  it("keeps match-day variation temporary and does not manufacture fitness on substitution", () => {
    const player = { ...buildReadySquad("flu")[0]!, condition: 32 };
    const saved = structuredClone(player);
    const attrs = matchAttributes(player, "readiness", "home");
    expect(attrs).toEqual(matchAttributes(player, "readiness", "home"));
    expect(attrs.stamina).toBe(32);
    expect(player).toEqual(saved);
    const sim = new MatchSim(buildTeamSetup("flu"), buildTeamSetup("bot"), "sub-fatigue");
    expect(sim.substitute("home", sim.players[0]!.pid, player)).toBe(true);
    expect(sim.players.find((p) => p.pid === player.id)!.stamina).toBe(32);
  });
  it("uses xG once and makes a better keeper reduce conversion without erasing good chances", () => {
    const shot = { xg: 0.25, shooting: 75, goalkeeper: 70, distance: 12 };
    const base = shotProbabilities(shot),
      elite = shotProbabilities({ ...shot, goalkeeper: 90 });
    expect(base.onTarget * base.goalGivenTarget).toBeCloseTo(base.conversion, 10);
    expect(elite.conversion).toBeLessThan(base.conversion);
    expect(elite.conversion).toBeGreaterThan(0.17);
    expect(shotProbabilities({ ...shot, xg: 0.01 }).conversion).toBeLessThan(0.02);
  });
});

it("allows a weaker 3D team to beat a favorite with the real live time step", () => {
  let wins = 0,
    favoriteWins = 0,
    goals = 0;
  for (let i = 0; i < 24; i++) {
    const sim = new MatchSim(buildTeamSetup("vit"), buildTeamSetup("fla"), `realism-audit-${i}`);
    let guard = 0;
    while (!sim.finished && guard++ < MATCH_SIMULATION_TICK_LIMIT)
      sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    expect(sim.finished).toBe(true);
    const h = sim.stats.home.goals,
      a = sim.stats.away.goals;
    if (h > a) wins++;
    else if (a > h) favoriteWins++;
    goals += h + a;
  }
  expect(wins).toBeGreaterThan(0);
  expect(favoriteWins).toBeGreaterThan(wins);
  expect(goals / 24).toBeGreaterThan(1.4);
  expect(goals / 24).toBeLessThan(4);
}, 120_000);
