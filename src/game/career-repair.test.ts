import { describe, expect, it } from "vitest";
import { initCareer } from "./career";
import { repairCareer } from "./career-repair";
import { careerMatchEligibilityInput, getMatchEligibilityFailure } from "./match-eligibility";
import { LEAGUES } from "./data/leagues";

const fresh = () => initCareer(LEAGUES[0]!.id, LEAGUES[0]!.clubs[0]!.id, "Teste");

describe("repairCareer", () => {
  it("não mexe em uma carreira nova", () => {
    const s = fresh();
    const r = repairCareer(s);
    expect(r.fixes).toEqual([]);
    expect(r.state).toBe(s);
  });

  it("preserva titulares temporariamente indisponíveis durante a reparação do save", () => {
    const s = fresh();
    const injured = s.lineup[0]!;
    const suspended = s.lineup[1]!;
    const repaired = repairCareer({
      ...s,
      players: {
        ...s.players,
        [injured]: { ...s.players[injured]!, injuryWeeks: 2 },
        [suspended]: { ...s.players[suspended]!, suspended: true },
      },
    });

    expect(repaired.state.lineup).toEqual(s.lineup);
    expect(repaired.state.players[injured]!.injuryWeeks).toBe(2);
    expect(repaired.state.players[suspended]!.suspended).toBe(true);
    expect(repaired.fixes).toEqual([]);
  });

  it("adiciona flag padrão de suspensão ausente em um save antigo", () => {
    const s = fresh();
    const id = s.lineup[0]!;
    const legacyPlayer = { ...s.players[id]! } as Record<string, unknown>;
    delete legacyPlayer["suspended"];
    const repaired = repairCareer({
      ...s,
      players: { ...s.players, [id]: legacyPlayer },
    } as unknown as typeof s);

    expect(repaired.state.players[id]!.suspended).toBe(false);
  });

  it("conserta atributos, escalação, calendário e medidores", () => {
    const s = fresh();
    const pid = s.lineup[0]!;
    const broken = {
      ...s,
      players: { ...s.players, [pid]: { ...s.players[pid]!, ovr: 140, condition: Number.NaN } },
      lineup: [...s.lineup],
      fixtures: [
        ...s.fixtures,
        s.fixtures[0]!,
        { ...s.fixtures[1]!, homeGoals: 2, awayGoals: null },
      ],
      approval: 180,
    };
    const r = repairCareer(broken);
    expect(r.state.players[pid]!.ovr).toBe(99);
    expect(r.state.players[pid]!.condition).toBe(100);
    expect(r.state.lineup).toHaveLength(11);
    expect(new Set(r.state.lineup).size).toBe(11);
    expect(r.state.lineup).not.toContain("fantasma");
    expect(r.state.fixtures.length).toBe(s.fixtures.length);
    expect(r.state.approval).toBe(100);
    expect(repairCareer(r.state).fixes).toEqual([]);
  });

  it("descarta entradas nulas e malformadas de fixtures e resultados", () => {
    const s = fresh();
    const repaired = repairCareer({
      ...s,
      fixtures: [null, s.fixtures[0], { round: "um", home: s.clubId, away: "flu" }],
      results: [null, { round: 1, home: s.clubId, away: "flu", hg: 2, ag: 0 }],
    } as unknown as typeof s);

    expect(repaired.state.fixtures).toEqual([s.fixtures[0]]);
    expect(repaired.state.results).toEqual([
      { round: 1, home: s.clubId, away: "flu", hg: 2, ag: 0 },
    ]);
    expect(repaired.fixes).toContain("2 partida(s) inválida(s) ou duplicada(s) removida(s)");
    expect(repaired.fixes).toContain("Resultados inválidos ou repetidos removidos do histórico");
    expect(() => repairCareer(repaired.state)).not.toThrow();
  });

  it("normaliza escalações malformadas antes de mesclar identidades duplicadas", () => {
    const s = fresh();
    const id = s.lineup[0]!;
    const player = s.players[id]!;
    const malformed = {
      ...s,
      lineup: [...s.lineup],
      players: {
        ...s.players,
        [id]: { ...player, sourcePlayerId: "same-record" },
        duplicate: { ...player, id: "duplicate", sourcePlayerId: "same-record" },
      },
      offers: [null],
      matchLog: [null],
      world: { relationships: null, memories: null },
    } as unknown as typeof s;

    const repaired = repairCareer(malformed);

    expect(repaired.state.lineup).toHaveLength(11);
    expect(
      Object.values(repaired.state.players).filter(
        (entry) => entry.sourcePlayerId === "same-record",
      ),
    ).toHaveLength(1);
    expect(repaired.fixes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cópia(s) de jogadores com a mesma identidade"),
      ]),
    );
  });

  it("preserva escalação incompleta no save e bloqueia o início da partida", () => {
    const s = fresh();
    const repaired = repairCareer({ ...s, lineup: s.lineup.slice(0, 10) });

    expect(repaired.state.lineup).toEqual(s.lineup.slice(0, 10));
    expect(repaired.fixes).toEqual([]);
    expect(getMatchEligibilityFailure(careerMatchEligibilityInput(repaired.state))?.code).toBe(
      "lineup-count",
    );
  });

  it("limita novos dados de operação e treino sem quebrar save antigo", () => {
    const s = fresh();
    const broken = {
      ...s,
      operatingPlan: { academy: 99, medical: "ruim", scouting: -4, commercial: 1 },
      financeLedger: [
        null,
        { id: "ok", season: 1, round: 1, kind: "operacao", label: "Teste", income: 2, expense: 1 },
      ],
      trainingReports: [{ id: "bad", drillId: 14 }, null],
    } as unknown as typeof s;

    const repaired = repairCareer(broken);

    expect(repaired.state.operatingPlan).toEqual({
      academy: 3,
      medical: 1,
      scouting: 0,
      commercial: 1,
    });
    expect(repaired.state.financeLedger).toHaveLength(1);
    expect(repaired.state.trainingReports).toHaveLength(0);
    expect(repaired.fixes).toContain("Lançamentos financeiros inválidos corrigidos");
  });
});
