import { describe, expect, it } from "vitest";
import { advanceRound, initCareer, migrateCareer } from "./career";
import { CLUBS, LEAGUES, getLeague } from "./data/leagues";
import { confederationFor, countryRegulation, promotionRule } from "./competition-regulations";
import {
  applyRegionalEntries,
  resolveQualifications,
  regionalFinals,
  seasonTables,
  sameClub,
} from "./competition-season";
import { createCups, playCupStage } from "./cup";
import { computeTable } from "./season";
import { applyPyramid, pyramidZones, leagueClubIds } from "./pyramid";
import { rankTable } from "./standings";
import type { CareerState, CupState, TableRow } from "./types";

const rows = (leagueId: string) =>
  getLeague(leagueId).clubs.map((c) => ({
    clubId: c.id,
    p: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    pts: 0,
  }));
const base = (leagueId = "bra") => initCareer(leagueId, getLeague(leagueId).clubs[0]!.id, "Teste");
const cup = (competitionId: string, winner: string, finalists = [winner]): CupState => ({
  id: competitionId.startsWith("regional:") ? "regional" : "national",
  competitionId,
  name: "Teste",
  winner,
  finalists,
  stage: 3,
  ties: [],
  out: false,
  everyRounds: 1,
});

describe("classificação entre campeonatos", () => {
  it("mapeia todos os países do catálogo sem enviar Europa, África ou Oceania para a AFC", () => {
    for (const country of new Set(LEAGUES.map((l) => l.country)))
      expect(confederationFor(country), country).not.toBeNull();
    expect(confederationFor("Austrália")).toBe("AFC");
    expect(confederationFor("Nova Zelândia")).toBe("OFC");
    expect(confederationFor("Cazaquistão")).toBe("UEFA");
  });
  it("Capixaba campeão recebe Série D e Copa do Brasil; vice só recebe Copa", () => {
    const state = base("x5686"),
      table = rows("x5686"),
      [champion, runnerUp] = table.map((r) => r.clubId);
    const entries = resolveQualifications(state, { x5686: table }, [
      cup("regional:x5686", champion!, [champion!, runnerUp!]),
    ]);
    expect(entries.filter((e) => e.clubId === champion).map((e) => e.competitionId)).toEqual([
      "league:y5079b",
      "national:Brasil",
    ]);
    expect(entries.filter((e) => e.clubId === runnerUp).map((e) => e.competitionId)).toEqual([
      "national:Brasil",
    ]);
    const admitted = applyRegionalEntries(state, {}, entries, { x5686: table });
    expect(admitted.leagueId).toBe("y5079b");
    expect(admitted.leagueClubs["y5079b"]).toContain(champion);
    expect(admitted.leagueClubs["y5079b"]).toHaveLength(getLeague("y5079b").clubs.length);
    expect(getLeague("x5686").clubs.some((c) => c.id === champion)).toBe(true);
  });
  it("repassa a vaga estadual quando o campeão já está na Série C e preserva a identidade do clube", () => {
    const state = base("x5686"),
      table = rows("x5686"),
      [champion, runnerUp] = table.map((r) => r.clubId);
    const composition = {
      bra3: [
        champion!,
        ...getLeague("bra3")
          .clubs.slice(1)
          .map((c) => c.id),
      ],
    };
    const entries = resolveQualifications(
      state,
      { x5686: table },
      [cup("regional:x5686", champion!, [champion!, runnerUp!])],
      composition,
    );
    expect(entries.find((e) => e.competitionId === "league:y5079b")?.clubId).toBe(runnerUp);
    const aliases = Object.keys(CLUBS).filter((id) => id !== champion && sameClub(id, champion!));
    for (const alias of aliases) expect(sameClub(alias, champion!)).toBe(true);
  });
  it("copa e liga repassam vagas sem duplicação e barram campeão de copa fora da Série A", () => {
    const state = base(),
      table = rows("bra"),
      champion = table[0]!.clubId,
      runner = table[8]!.clubId;
    const entries = resolveQualifications(state, { bra: table }, [
      cup("national:Brasil", champion, [champion, runner]),
    ]);
    const lib = entries.filter((e) => e.competitionId === "continental:CONMEBOL");
    expect(lib).toHaveLength(7);
    expect(new Set(lib.map((e) => e.clubId)).size).toBe(7);
    expect(lib.find((e) => e.clubId === runner)?.phase).toBe("preliminar");
    const lower = getLeague("x5686").clubs[0]!.id;
    const lowerWin = resolveQualifications(state, { bra: table }, [
      cup("national:Brasil", lower, [lower, runner]),
    ]);
    expect(
      lowerWin.some((e) => e.clubId === lower && e.competitionId === "continental:CONMEBOL"),
    ).toBe(false);
    expect(lowerWin.filter((e) => e.competitionId === "continental:CONMEBOL")).toHaveLength(7);
  });
  it("um clube estadual não entra automaticamente na Libertadores", () => {
    const state = base("x5686"),
      cups = createCups(state);
    const continental = cups.find((c) => c.competitionId === "continental:CONMEBOL")!;
    expect(continental.entered).toBe(false);
    expect(continental.groups?.flatMap((g) => g.clubIds)).not.toContain(state.clubId);
  });
  it("continua as copas eliminadas até ter campeão e lida com campos ímpares", () => {
    const state = base();
    const all = createCups(state);
    for (const initial of all) {
      let current = { ...initial, out: true };
      for (let i = 0; i < 16 && !current.winner; i++) current = playCupStage(current, state).cup;
      expect(current.winner, initial.competitionId).toBeTruthy();
      expect(
        current.ties.every((t) => Boolean(CLUBS[t.home] && CLUBS[t.away]) && t.home !== t.away),
      ).toBe(true);
    }
  });
  it("fecha uma carreira real com vagas, campeões, expansão da Série C e calendário da próxima divisão", () => {
    let state = base("x5686");
    state = {
      ...state,
      fixtures: state.fixtures.map((f) => ({ ...f, homeGoals: 2, awayGoals: 1 })),
      round: 40,
      pressure: 0,
    };
    const table = computeTable(state),
      tables = seasonTables(state, table),
      champ = regionalFinals(state, tables).cups.find(
        (c) => c.competitionId === "regional:x5686",
      )!.winner!;
    const trainer = initCareer("x5686", champ, "Teste");
    const next = advanceRound(
      { ...trainer, fixtures: state.fixtures, round: 40, cups: createCups(trainer), pressure: 0 },
      { hg: 0, ag: 0 },
    );
    expect(next.season).toBe(2);
    expect(next.calendarYear).toBe(2027);
    expect(next.leagueId).toBe("y5079b");
    expect(next.fixtures.some((f) => f.home === champ || f.away === champ)).toBe(true);
    expect(
      next.qualifications?.find((e) => e.clubId === champ && e.competitionId === "league:y5079b"),
    ).toBeTruthy();
    expect(Object.keys(next.competitionHistory![0]!.champions).length).toBeGreaterThan(6);
    expect(next.trophies.some((t) => t.name === getLeague("x5686").name)).toBe(true);
    expect(next.competitionHistory![0]!.playoffs?.length).toBeGreaterThan(0);
    expect(migrateCareer(JSON.parse(JSON.stringify(next))).qualifications).toEqual(
      next.qualifications,
    );
    // O clube não some nem se duplica dentro da pirâmide nacional; estadual é uma competição paralela.
    const ids = ["bra", "bra2", "bra3", "y5079a", "y5079b", "y5079c"].flatMap((id) =>
      leagueClubIds(next, id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("regulamentos nacionais e critérios de tabela", () => {
  it("marca Série B com dois acessos diretos e quatro candidatos a duas vagas", () => {
    const zones = pyramidZones("bra2", 20);
    expect(zones.slice(0, 2)).toEqual(["acesso", "acesso"]);
    expect(zones.slice(2, 6)).toEqual(Array(4).fill("playoff"));
    expect(promotionRule("bra").playoff).toBe(2);
  });
  it("resolve permanência alemã em ida/volta e conserva todos os clubes", () => {
    const state = base("ger2"),
      table = rows("ger2");
    const result = applyPyramid(state, table)!;
    const playoff = result.playoffs.find((p) => p.home === table[2]!.clubId)!;
    expect(playoff).toBeTruthy();
    const all = Object.values(result.leagueClubs).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(pyramidZones("ger", 18).slice(-3)).toEqual(["playoff", "rebaixamento", "rebaixamento"]);
  });
  it("distingue liga fechada e suspensão continental", () => {
    expect(applyPyramid(base("mex"), rows("mex"))).toBeNull();
    expect(countryRegulation("Rússia").primary).toBe(0);
    expect(countryRegulation("Inglaterra", 2026).primary).toBe(5);
    expect(countryRegulation("França").primaryDirect).toBe(3);
  });
  it("Brasil desempata por vitórias antes do saldo e Espanha por confronto direto", () => {
    const a = { ...rows("bra")[0]!, pts: 10, w: 3, gf: 5, ga: 10 },
      b = { ...rows("bra")[1]!, pts: 10, w: 2, gf: 10, ga: 2 };
    expect(rankTable([b, a], [], "Brasil")[0]!.clubId).toBe(a.clubId);
    const match = { round: 1, home: a.clubId, away: b.clubId, homeGoals: 2, awayGoals: 0 };
    expect(rankTable([b, a], [match], "Espanha")[0]!.clubId).toBe(a.clubId);
  });
});
