import { describe, expect, it } from "vitest";
import { validCatalogIdentity, validCatalogLabel } from "./catalog-integrity";
import { isNonPlayerRole, isPlayerRecord } from "./football-person-kind";
import { validateRemotePlayers } from "./football-ingestion-validation";

describe("catalog admission", () => {
  it("rejects blank labels and serialized placeholders without using names as identity", () => {
    for (const value of [null, undefined, 42, "", " \t ", "null", "undefined", "[object Object]"])
      expect(validCatalogLabel(value)).toBe(false);
    expect(validCatalogLabel(" Fluminense ")).toBe(true);
    expect(validCatalogIdentity("team-42")).toBe(true);
    expect(validCatalogIdentity(" team-42 ")).toBe(false);
  });
  it("rejects staff before position mapping, including misleading normalized positions", () => {
    for (const role of [
      "Manager",
      "Assistant Coach",
      "Goalkeeper Coach",
      "Head Coach",
      "Técnico",
      "Preparador físico",
      "Physiotherapist",
    ]) {
      expect(isNonPlayerRole(role), role).toBe(true);
      expect(isPlayerRecord({ position: "MF", rawPosition: role }), role).toBe(false);
    }
    expect(isPlayerRecord({ source_kind: "coach", position: "MF" })).toBe(false);
    expect(isPlayerRecord({ sourceKind: "player", position: "MF" })).toBe(true);
    expect(
      isPlayerRecord({ sourceKind: "player", position: "MF", canonical_player_id: "canonical-42" }),
    ).toBe(false);
    expect(
      isPlayerRecord({ sourceKind: "player", position: "MF", canonical_player_id: null }),
    ).toBe(true);
    expect(isPlayerRecord({ position: "GK" })).toBe(true);
    expect(isNonPlayerRole("Defensive Midfielder")).toBe(false);
    const fixture = { source: "provider", externalId: "42", name: "Homônimo", position: "MF" };
    expect(
      validateRemotePlayers([
        { ...fixture, sourceKind: "coach" },
        { ...fixture, rawPosition: "Goalkeeper Coach" },
        fixture,
      ]).accepted,
    ).toEqual([fixture]);
  });
});
