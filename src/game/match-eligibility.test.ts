import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { getMatchEligibilityFailure, isMatchEligible } from "./match-eligibility";

function setup() {
  return buildTeamSetup("fla");
}

describe("match eligibility gate", () => {
  it("admits exactly eleven available starters with a goalkeeper", () => {
    expect(isMatchEligible(setup())).toBe(true);
    expect(getMatchEligibilityFailure(setup())).toBeNull();
  });

  it("keeps actionable player numbers in the user-facing failure adapter", () => {
    const team = setup();
    const invalidId = {
      ...team,
      players: team.players.map((player, index) => (index === 1 ? { ...player, id: "" } : player)),
    };
    expect(getMatchEligibilityFailure(invalidId)).toEqual({
      code: "invalid-player",
      message:
        "Escalação inválida: o jogador 2 não tem um ID válido. Abra o elenco e escolha novamente.",
    });

    const missingPlayer = {
      ...team,
      players: team.players.map((player, index) => (index === 1 ? null : player)),
    };
    expect(getMatchEligibilityFailure(missingPlayer)?.message).toBe(
      "Escalação inválida: o jogador 2 não existe mais no elenco. Abra o elenco e escolha novamente.",
    );
  });

  it.each([
    [
      "titulares faltantes",
      (team: ReturnType<typeof setup>) => ({ ...team, players: team.players.slice(0, 10) }),
      "lineup-count",
    ],
    [
      "sem goleiro",
      (team: ReturnType<typeof setup>) => ({
        ...team,
        players: team.players.map((player) => ({
          ...player,
          pos: player.pos === "GK" ? "DF" : player.pos,
        })),
      }),
      "goalkeeper",
    ],
    [
      "titular lesionado",
      (team: ReturnType<typeof setup>) => ({
        ...team,
        players: team.players.map((player, index) =>
          index === 1 ? { ...player, injuryWeeks: 1 } : player,
        ),
      }),
      "injury",
    ],
    [
      "titular suspenso",
      (team: ReturnType<typeof setup>) => ({
        ...team,
        players: team.players.map((player, index) =>
          index === 1 ? { ...player, suspended: true } : player,
        ),
      }),
      "suspension",
    ],
    [
      "clube divergente",
      (team: ReturnType<typeof setup>) => ({
        ...team,
        players: team.players.map((player, index) =>
          index === 1 ? { ...player, clubId: "pal" } : player,
        ),
      }),
      "club-mismatch",
    ],
    [
      "ID repetido",
      (team: ReturnType<typeof setup>) => ({
        ...team,
        players: team.players.map((player, index) =>
          index === 1 ? { ...player, id: team.players[0]!.id } : player,
        ),
      }),
      "duplicate-id",
    ],
  ] as const)("rejeita %s sem reparar a entrada", (_label, mutate, code) => {
    const original = setup();
    const candidate = mutate(original);
    const failure = getMatchEligibilityFailure(candidate);
    expect(failure?.code).toBe(code);
    expect(isMatchEligible(candidate)).toBe(false);
    expect(original.players).toEqual(setup().players);
  });

  it("rejeita um jogador de banco repetido com titular", () => {
    const team = setup();
    const failure = getMatchEligibilityFailure({
      ...team,
      bench: [team.players[0]],
    });
    expect(failure?.code).toBe("duplicate-id");
  });
});
