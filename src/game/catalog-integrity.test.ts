import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { CLUBS, LEAGUES, getLeague } from "./data/leagues";
import { SERIE_D_IDS } from "./data/serie-d";
import { pyramidTiers } from "./pyramid";
import { generateFixtures } from "./season";
import { initCareer, migrateCareer } from "./career";
import { buildSquad } from "./squad";
import { applyImportedSquad } from "./squad-import";
import { updatedSeasonComposition } from "./catalog-season";
import type { RealPlayer } from "../lib/realSquads";

describe("catalog composition and full squads", () => {
  it("preserves identities and random condition/morale when the roster grows", () => {
    // Original 18-player fingerprints exclude ratings, which are calibrated separately.
    // The migration test below verifies that existing saved attributes remain unchanged.
    const fingerprints = {
      fla: "09594c255f1297f15255f267d1bd03dfc391dc81860dda9351233b40d60c1f88",
      bot: "a98edea51f88f044d46a3ab89c8714f89662a9291dd00686b9fb1b8d54b86ffc",
      "nao-existe-123": "081d14e7e29345e18b97ad52a43a40292eafbbc15affbdfc725e82a13acf70e0",
    };
    for (const [id, hash] of Object.entries(fingerprints)) {
      const core = buildSquad(id)
        .slice(0, 18)
        .map(({ rosterSource, ovr, pace, shooting, passing, defending, physical, ...p }) => p);
      expect(createHash("sha256").update(JSON.stringify(core)).digest("hex"), id).toBe(hash);
    }
  });
  it("uses the corrected fields and a complete home/away calendar", () => {
    const sizes = {
      sco: 12,
      sui: 12,
      aut: 12,
      den: 12,
      gre: 14,
      kor: 12,
      hrv: 10,
      arg: 30,
      x4396: 24,
      x4824: 20,
      y4616a: 18,
      arg2: 18,
    };
    for (const [id, size] of Object.entries(sizes)) {
      expect(getLeague(id).clubs.length, id).toBe(size);
      expect(generateFixtures(id, "catalog").length, id).toBe(size * (size - 1));
    }
    expect(SERIE_D_IDS.flatMap((id) => getLeague(id).clubs)).toHaveLength(96);
    for (const id of SERIE_D_IDS) expect(getLeague(id).clubs).toHaveLength(6);
    for (let i = 5777; i <= 5784; i++) expect(getLeague(`y${i}`).clubs).toHaveLength(14);
  });
  it("never repeats a club within a league or its national pyramid", () => {
    for (const league of LEAGUES) {
      expect(new Set(league.clubs.map((c) => c.id)).size, league.id).toBe(league.clubs.length);
      const chain = pyramidTiers(league.id)?.flat();
      if (chain?.[0] !== league.id) continue;
      const clubs = LEAGUES.filter((l) => chain.includes(l.id)).flatMap((l) => l.clubs);
      expect(new Set(clubs.map((c) => c.id)).size, league.id).toBe(clubs.length);
      expect(
        new Set(clubs.map((c) => c.sourceTeamId ?? c.id)).size,
        `${league.id} source identity`,
      ).toBe(clubs.length);
    }
  });
  it("keeps 40 valid imported records, their positions and source identities", () => {
    const records: RealPlayer[] = Array.from({ length: 40 }, (_, i) => ({
      id: `source-${i}`,
      name: `Atleta ${i}`,
      position: i < 3 ? "GK" : i < 15 ? "DF" : i < 28 ? "MF" : "FW",
      age: 24,
      shirt_number: 9,
      nationality: "Brasil",
      overall: 70,
      photo_url: null,
    }));
    const squad = applyImportedSquad("flu", buildSquad("flu"), [...records, records[0]!]);
    expect(squad).toHaveLength(40);
    expect(new Set(squad.map((p) => p.id)).size).toBe(40);
    expect(new Set(squad.map((p) => p.number)).size).toBe(40);
    for (const r of records)
      expect(squad.find((p) => p.sourcePlayerId === r.id)?.pos).toBe(r.position);
  });
  it("expands a legacy roster once without changing its players or resurrecting later sales", () => {
    const fresh = initCareer("bra", "flu", "Migração");
    const old = {
      ...fresh,
      catalogRevision: undefined,
      players: Object.fromEntries(Object.entries(fresh.players).slice(0, 18)),
    };
    const migrated = migrateCareer(old);
    expect(Object.keys(migrated.players)).toHaveLength(26);
    for (const [id, p] of Object.entries(old.players)) expect(migrated.players[id]).toEqual(p);
    const sold = Object.keys(migrated.players).at(-1)!;
    const players = { ...migrated.players };
    delete players[sold];
    expect(migrateCareer({ ...migrated, players }).players[sold]).toBeUndefined();
    expect(CLUBS["flu"]?.name).toBe("Fluminense");
  });
  it("repairs an unstarted incomplete calendar and preserves a season already played", () => {
    const club = getLeague("sco").clubs[0]!.id;
    const fresh = initCareer("sco", club, "Tabela");
    const partial = generateFixtures(
      "sco",
      "old",
      getLeague("sco")
        .clubs.slice(0, 8)
        .map((c) => c.id),
    );
    const old = { ...fresh, catalogRevision: undefined, fixtures: partial };
    expect(migrateCareer(old).fixtures).toHaveLength(132);
    const played = {
      ...old,
      round: 2,
      fixtures: partial.map((f, i) => (i === 0 ? { ...f, homeGoals: 2, awayGoals: 1 } : f)),
    };
    const migrated = migrateCareer(played);
    expect(migrated.fixtures).toEqual(played.fixtures);
    expect(migrated.leagueClubs?.["sco"]).toHaveLength(8);
    expect(migrated.catalogCalendarPending).toBe(true);
    const composition = updatedSeasonComposition(migrated, migrated.leagueClubs, "sco");
    expect(composition?.["sco"]).toHaveLength(12);
    expect(composition?.["sco"]).toContain(club);
    const national = pyramidTiers("sco")!
      .flat()
      .flatMap((id) => composition?.[id] ?? []);
    expect(new Set(national).size).toBe(national.length);
  });
});
