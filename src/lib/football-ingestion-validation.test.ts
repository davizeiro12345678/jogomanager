import { describe, expect, it } from "vitest";

import { validateRemotePlayers } from "./football-ingestion-validation";

describe("football ingestion validation", () => {
  it("normalizes valid provider rows and removes malformed or duplicate records", () => {
    const result = validateRemotePlayers([
      {
        source: " provider-a ",
        externalId: " 42 ",
        name: "  Jogador válido  ",
        position: "MF",
        age: 24,
        shirtNumber: 8,
        nationality: " Brasil ",
        photoUrl: "https://assets.example.test/player.webp",
      },
      {
        source: "provider-a",
        externalId: "42",
        name: "Duplicado",
        position: "MF",
      },
      {
        source: "provider-b",
        externalId: "invalido",
        name: "",
        position: "GK",
      },
      {
        source: "provider-c",
        externalId: "idade-invalida",
        name: "Idade inválida",
        position: "DF",
        age: 71,
      },
    ]);

    expect(result.accepted).toEqual([
      {
        source: "provider-a",
        externalId: "42",
        name: "Jogador válido",
        position: "MF",
        age: 24,
        shirtNumber: 8,
        nationality: "Brasil",
        photoUrl: "https://assets.example.test/player.webp",
      },
    ]);
    expect(result.rejected).toHaveLength(3);
    expect(result.rejected.map((row) => row.reason)).toEqual([
      "duplicate-provider-id",
      "schema",
      "schema",
    ]);
  });
});
