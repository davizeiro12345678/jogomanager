import { expect, it } from "vitest";

import { initCareer } from "./career";
import { setAttrDeltas } from "./attributes";
import { runDrill } from "./training-drills";

it("gera um relatório de treino individual e deltas detalhados determinísticos", () => {
  const state = { ...initCareer("bra", "fla", "Treino"), trainingIntensity: 1 as const };
  setAttrDeltas({});
  const first = runDrill(state, "posse");
  setAttrDeltas({});
  const second = runDrill(state, "posse");

  expect(first.drillsByRound?.["1-1"]).toBe("posse");
  expect(first.trainingReports?.[0]).toMatchObject({ drillId: "posse", load: 4 });
  expect(first.attrDeltas).toEqual(second.attrDeltas);
  expect(first.trainingReports).toEqual(second.trainingReports);
});

it("não reaplica um exercício já realizado na mesma rodada", () => {
  const state = initCareer("bra", "fla", "Treino");
  const completed = runDrill(state, "linha");

  expect(runDrill(completed, "finalizacao")).toBe(completed);
});

it("preserva atletas externos e registra evolução detalhada ao longo de sessões", () => {
  let state = initCareer("bra", "fla", "Treino");
  const outsider = { ...Object.values(state.players)[0]!, id: "outsider", clubId: "bot" };
  state = { ...state, players: { ...state.players, [outsider.id]: outsider } };
  for (let round = 1; round <= 10; round++) state = runDrill({ ...state, round }, "posse");
  expect(state.players[outsider.id]).toEqual(outsider);
  expect(Object.keys(state.attrDeltas ?? {}).length).toBeGreaterThan(0);
  expect(state.trainingReports?.[0]?.recovery).toBeGreaterThanOrEqual(0);
  expect(state.trainingReports?.[0]?.recovery).toBeLessThanOrEqual(100);
});
