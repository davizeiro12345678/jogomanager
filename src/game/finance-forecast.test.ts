import { expect, it } from "vitest";

import { initCareer } from "./career";
import { endSeason } from "./career-season-end";
import { addMoney } from "./financial-inputs";
import {
  operatingPlanFor,
  projectFinanceHorizon,
  projectWeeklyFinance,
  settleSeasonPrize,
  settleWeeklyFinance,
  updateOperatingPlan,
} from "./finance-forecast";

it("decompõe uma rodada financeira em valores finitos e auditáveis", () => {
  const state = initCareer("bra", "fla", "Financeiro");
  const projection = projectWeeklyFinance(state, { position: 3, won: true, homeGame: true });

  expect(projection.income).toBeGreaterThan(0);
  expect(projection.expense).toBeGreaterThan(0);
  expect(Number.isFinite(projection.net)).toBe(true);
  expect(projection.revenue.ticketing).toBeGreaterThan(0);
  expect(projection.costs.wages).toBeGreaterThan(0);
});

it("mantém o preview sem mutar o caixa e confirma a mesma projeção da semana", () => {
  const state = initCareer("bra", "fla", "Preview");
  const before = JSON.stringify(state);
  const preview = projectFinanceHorizon(state, 1);
  const week = preview.weeks[0]!;
  const confirmed = settleWeeklyFinance(state, {
    position: state.objective,
    won: false,
    homeGame: week.homeGame,
    played: week.played,
  });

  expect(JSON.stringify(state)).toBe(before);
  expect(confirmed.projection).toEqual(week.projection);
  expect(confirmed.state.finances.budget).toBe(week.closingCash);
});

it("registra operação semanal uma única vez ao reprocessar a mesma rodada", () => {
  const state = initCareer("bra", "fla", "Financeiro");
  const first = settleWeeklyFinance(state, { position: 8, won: false, homeGame: false });
  const second = settleWeeklyFinance(first.state, { position: 8, won: false, homeGame: false });

  expect(first.settled).toBe(true);
  expect(first.state.financeLedger).toHaveLength(1);
  expect(second.settled).toBe(false);
  expect(second.state.finances).toEqual(first.state.finances);
  expect(second.state.financeLedger).toEqual(first.state.financeLedger);
});

it("normaliza o plano operacional e preserva níveis compatíveis no save", () => {
  const state = initCareer("bra", "fla", "Financeiro");
  const updated = updateOperatingPlan(state, { academy: 3, medical: 2, scouting: 0 });

  expect(operatingPlanFor(updated)).toEqual({ academy: 3, medical: 2, scouting: 0, commercial: 1 });
});

it("confirma a premiação no orçamento e retorna o mesmo estado em replay", () => {
  const state = initCareer("bra", "fla", "Prize");
  const first = settleSeasonPrize(state, 1.25);
  const replay = settleSeasonPrize(first.state, 1.25);

  expect(first.settled).toBe(true);
  expect(first.state.finances.budget).toBe(addMoney(state.finances.budget, 1.25));
  expect(first.state.finances.income).toBe(addMoney(state.finances.income, 1.25));
  expect(first.state.financeLedger).toHaveLength(1);
  expect(first.state.financeLedger?.[0]).toMatchObject({
    id: `season-prize-${state.clubId}-${state.season}`,
    kind: "premio",
    income: 1.25,
    expense: 0,
  });
  expect(replay.settled).toBe(false);
  expect(replay.state).toBe(first.state);
});

it("não reaplica prêmio depois que seu evento sai do ledger, mantendo o ID durável", () => {
  const state = initCareer("bra", "fla", "Prize replay");
  const first = settleSeasonPrize(state, 1.25);
  const eventId = `season-prize-${state.clubId}-${state.season}`;
  const truncated = { ...first.state, financeLedger: [] };
  const replay = settleSeasonPrize(truncated, 1.25);

  expect(first.state.financeAppliedEventIds).toContain(eventId);
  expect(replay.settled).toBe(false);
  expect(replay.state.finances).toEqual(first.state.finances);
  expect(replay.state.financeAppliedEventIds).toContain(eventId);
});

it("promove ID legado ainda presente no ledger sem recreditar o prêmio", () => {
  const state = initCareer("bra", "fla", "Legacy prize");
  const eventId = `season-prize-${state.clubId}-${state.season}`;
  const legacy = {
    ...state,
    financeLedger: [
      {
        id: eventId,
        season: state.season,
        round: state.round,
        kind: "premio" as const,
        label: "Premiação de fim de temporada",
        income: 1.25,
        expense: 0,
      },
    ],
  };
  const settled = settleSeasonPrize(legacy, 1.25);

  expect(settled.settled).toBe(false);
  expect(settled.state.finances).toEqual(state.finances);
  expect(settled.state.financeAppliedEventIds).toContain(eventId);
});

it("reconhece ID semanal applied sem cursor e preserva cursor semanal existente", () => {
  const state = initCareer("bra", "fla", "Weekly applied");
  const result = { position: 8, won: false, homeGame: false };
  const eventId = `operations-${state.clubId}-${state.season}-${state.round}`;
  const appliedWithoutCursor = { ...state, financeAppliedEventIds: [eventId] };
  const replay = settleWeeklyFinance(appliedWithoutCursor, result);

  expect(replay.settled).toBe(false);
  expect(replay.state).toBe(appliedWithoutCursor);

  const futureCursor = {
    clubId: state.clubId,
    season: state.season + 1,
    round: 1,
  };
  const alreadySettled = settleWeeklyFinance(
    { ...state, financeSettledThrough: futureCursor },
    result,
  );
  expect(alreadySettled.settled).toBe(false);
  expect(alreadySettled.state.financeSettledThrough).toEqual(futureCursor);

  const cursor = { clubId: state.clubId, season: state.season, round: state.round - 1 };
  const first = settleWeeklyFinance({ ...state, financeSettledThrough: cursor }, result);
  expect(first.settled).toBe(true);
  expect(first.state.financeSettledThrough).toEqual({
    clubId: state.clubId,
    season: state.season,
    round: state.round,
  });
});

it("inclui a premiação de fechamento no ledger sem manter agregados da temporada anterior", () => {
  const state = initCareer("bra", "fla", "Season prize");
  const next = endSeason(state);
  const prize = next.financeLedger?.find(
    (entry) => entry.id === `season-prize-${state.clubId}-${state.season}`,
  );

  expect(prize).toBeDefined();
  expect(next.finances.budget).toBe(addMoney(state.finances.budget, prize!.income));
  expect(next.finances.spent).toBe(0);
  expect(next.finances.income).toBe(0);
});

it("não cobra viagem em folga nem salários do clube anterior", () => {
  const state = initCareer("bra", "fla", "Financeiro");
  const fixture = { position: 3, won: false, homeGame: false, played: false };
  const projection = projectWeeklyFinance(state, fixture);
  const outsider = {
    ...Object.values(state.players)[0]!,
    id: "other-club",
    clubId: "bot",
    wage: 100000,
  };
  expect(projection.costs.travel).toBe(0);
  expect(
    projectWeeklyFinance(
      { ...state, players: { ...state.players, [outsider.id]: outsider } },
      fixture,
    ).costs.wages,
  ).toBe(projection.costs.wages);
});
