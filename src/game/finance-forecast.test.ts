import { expect, it } from "vitest";

import { initCareer } from "./career";
import {
  operatingPlanFor,
  projectWeeklyFinance,
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
