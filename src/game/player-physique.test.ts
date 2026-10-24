import { expect, it } from "vitest";
import { profileFor, setAttrDeltas } from "./attributes";
import { buildAttrs, physiqueFor } from "./player-physique";
import { buildTeamSetup } from "./quickMatch";
import type { Position } from "./types";

it("preserves full-profile measurements across positions and random dominant-foot branches", () => {
  const original = buildTeamSetup("fla").players[0]!;
  for (const pos of ["GK", "DF", "MF", "FW"] satisfies Position[]) {
    for (let index = 0; index < 32; index++) {
      const player = { ...original, id: `physique-${pos}-${index}`, name: `Atleta ${index}`, pos };
      const profile = profileFor(player);
      expect(physiqueFor(player)).toEqual({ height: profile.height, weight: profile.weight });
    }
  }
});

it("expõe atributos detalhados de decisão, disponibilidade e funções de goleiro", () => {
  const original = buildTeamSetup("fla").players[0]!;
  const field = profileFor({ ...original, id: "advanced-field", pos: "MF" });
  const keeper = profileFor({ ...original, id: "advanced-gk", pos: "GK" });

  expect(field.attrs).toMatchObject({
    technique: expect.any(Number),
    ballControl: expect.any(Number),
    anticipation: expect.any(Number),
    naturalFitness: expect.any(Number),
    consistency: expect.any(Number),
  });
  expect(keeper.attrs).toMatchObject({
    oneOnOnes: expect.any(Number),
    commandOfArea: expect.any(Number),
    rushingOut: expect.any(Number),
    communication: expect.any(Number),
  });
});

it("preserva o consumo de 29 amostras da identidade antiga ao expandir os atributos", () => {
  const original = buildTeamSetup("fla").players[0]!;
  for (const pos of ["GK", "DF", "MF", "FW"] satisfies Position[]) {
    let consumed = 0;
    buildAttrs({ ...original, pos }, () => {
      consumed++;
      return 0.5;
    });
    expect(consumed).toBe(29);
  }
});

it("atualiza a ficha quando a base muda e ignora deltas não finitos", () => {
  const original = buildTeamSetup("fla").players[0]!;
  setAttrDeltas({ [original.id]: { pace: NaN } });
  const before = profileFor(original);
  const after = profileFor({ ...original, pace: Math.min(99, original.pace + 10) });
  expect(Number.isFinite(before.attrs.pace)).toBe(true);
  expect(after.attrs.pace).toBeGreaterThanOrEqual(before.attrs.pace);
  expect(after).not.toBe(before);
  setAttrDeltas({});
});

it("invalidates reused roster measurements for every generation input and protects cached values", () => {
  const original = buildTeamSetup("fla").players[0]!;
  const player = { ...original, developmentBase: undefined };
  const first = physiqueFor(player);
  first.height = -999;
  expect(physiqueFor(player).height).not.toBe(-999);
  for (const change of [
    { id: "updated-id" },
    { name: "Updated name" },
    { pos: "MF" as const },
    { age: 35 },
    { ovr: 95 },
    { pace: 25 },
    { shooting: 99 },
    { passing: 22 },
    { defending: 98 },
    { physical: 20 },
  ]) {
    Object.assign(player, change);
    expect(physiqueFor(player)).toEqual(physiqueFor({ ...player }));
    const full = profileFor({ ...player });
    expect(physiqueFor(player)).toEqual({ height: full.height, weight: full.weight });
  }
});
