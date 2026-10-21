import path from "node:path";
import { rolldown } from "rolldown";
import { describe, expect, it } from "vitest";
import { profileFor, withDevelopmentBase } from "./attributes";
import { matchAttributes } from "./match-readiness";
import { matchProfileAttributes } from "./player-match-attributes";
import type { AttributeSource } from "./player-development";
import type { Player } from "./types";

const player: Player = {
  id: "attribute-contract",
  clubId: "fla",
  name: "Atributo Teste",
  pos: "MF",
  age: 22,
  number: 8,
  ovr: 74,
  pace: 72,
  shooting: 68,
  passing: 82,
  defending: 61,
  physical: 75,
  condition: 78,
  morale: 66,
  form: 58,
  personality: "profissional",
  goals: 3,
  assists: 5,
  apps: 12,
  wage: 10,
  value: 6,
  yellows: 1,
  suspended: false,
  injuryWeeks: 0,
};
const deltas = { technique: 0.75, teamwork: -2.4, anticipation: 300, consistency: -300 };
const imported: Player = {
  ...player,
  rosterSource: "imported",
  detailedAttributes: {
    ...profileFor(player).attrs,
    technique: 91.2,
    teamwork: 18,
    anticipation: 102,
    consistency: 80.5,
  },
};

describe("match attribute identity without profile history", () => {
  it("refreshes a warmed projection after ratings, imports, deltas or frozen identity change", () => {
    const input = { ...player, id: "warmed-match-projection" };
    const expected = (value: Player, source?: AttributeSource) => {
      const { consistency, technique, teamwork, anticipation } = profileFor(value, source).attrs;
      return { consistency, technique, teamwork, anticipation };
    };
    expect(matchProfileAttributes(input)).toEqual(expected(input));
    input.passing = 94;
    input.shooting = 90;
    expect(matchProfileAttributes(input)).toEqual(expected(input));
    input.age = 30;
    input.pos = "DF";
    expect(matchProfileAttributes(input)).toEqual(expected(input));
    input.developmentDelta = { technique: -8, teamwork: 3 };
    expect(matchProfileAttributes(input)).toEqual(expected(input));
    expect(matchProfileAttributes(input, {})).toEqual(expected(input, {}));
    const frozen = withDevelopmentBase(input, 2);
    frozen.developmentBase!.profile.attrs.technique = 95;
    expect(matchProfileAttributes(frozen)).toEqual(expected(frozen));
    // Consumers receive a projection, never a mutable reference to the cache.
    const result = matchProfileAttributes(input);
    result.technique = 20;
    expect(matchProfileAttributes(input)).toEqual(expected(input));
  });

  it("does not embed the club catalog in the compiled match-readiness dependency graph", async () => {
    const bundle = await rolldown({
      input: path.join(import.meta.dirname, "match-readiness.ts"),
    });
    try {
      const { output } = await bundle.generate({ format: "es", minify: true });
      const modules = output.flatMap((item) =>
        item.type === "chunk" ? Object.keys(item.modules) : [],
      );
      expect(modules).not.toContain(path.join(import.meta.dirname, "data/leagues.ts"));
    } finally {
      await bundle.close();
    }
  });

  it("keeps career development and finance out of the emitted worker entry", async () => {
    const bundle = await rolldown({
      input: path.join(import.meta.dirname, "match.worker.ts"),
      // Dependencies outside the game are irrelevant to this module boundary;
      // retain all local dynamic imports so shared modules cannot hide here.
      external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
    });
    try {
      const { output } = await bundle.generate({ format: "es", minify: true });
      const entry = output.find((item) => item.type === "chunk" && item.isEntry);
      expect(entry?.type).toBe("chunk");
      if (entry?.type !== "chunk") return;
      for (const name of ["player-development.ts", "economy.ts", "financial-inputs.ts"])
        expect(Object.keys(entry.modules)).not.toContain(path.join(import.meta.dirname, name));
    } finally {
      await bundle.close();
    }
  });

  it.each([
    ["GK", { consistency: 69, technique: 78, teamwork: 71, anticipation: 76 }],
    ["DF", { consistency: 69, technique: 78, teamwork: 71, anticipation: 76 }],
    ["MF", { consistency: 69, technique: 81, teamwork: 74, anticipation: 72 }],
    ["FW", { consistency: 69, technique: 78, teamwork: 71, anticipation: 72 }],
  ] as const)("preserves the legacy %s detailed identity", (pos, want) => {
    expect(profileFor({ ...player, pos }).attrs).toMatchObject(want);
    expect(matchProfileAttributes({ ...player, pos })).toEqual(want);
  });

  it("keeps exact seeded readiness values for both sides", () => {
    expect(matchAttributes(player, "match-attribute-contract", "home")).toEqual({
      pace: 71.30971231544297,
      shooting: 66.73884926177188,
      passing: 78.2788492617719,
      defending: 59.55884926177189,
      physical: 72.23884926177188,
      stamina: 78,
    });
    expect(matchAttributes(player, "match-attribute-contract", "away")).toEqual({
      pace: 71.90846684792312,
      shooting: 69.13386739169248,
      passing: 80.67386739169248,
      defending: 61.95386739169248,
      physical: 74.63386739169248,
      stamina: 78,
    });
  });

  it("gives finite legacy deltas priority over imports and honors an explicit empty source", () => {
    const input = { ...imported, developmentDelta: deltas };
    expect(profileFor(input).attrs).toMatchObject({
      technique: 82,
      teamwork: 72,
      anticipation: 99,
      consistency: 20,
    });
    expect(profileFor(input, {}).attrs).toMatchObject({
      technique: 91.2,
      teamwork: 20,
      anticipation: 99,
      consistency: 80.5,
    });
    expect(matchProfileAttributes(input)).toEqual({
      technique: 82,
      teamwork: 72,
      anticipation: 99,
      consistency: 20,
    });
    expect(matchProfileAttributes(input, {})).toEqual({
      technique: 91.2,
      teamwork: 20,
      anticipation: 99,
      consistency: 80.5,
    });
    expect(profileFor({ ...input, developmentDelta: { technique: NaN } }).attrs.technique).toBe(
      91.2,
    );
  });

  it.each([
    [1, { technique: 82, teamwork: 72, anticipation: 99, consistency: 20 }],
    [2, { technique: 78.75, teamwork: 71.6, anticipation: 99, consistency: 20 }],
  ] as const)("preserves frozen rules %i identity, rounding and bounds", (rules, want) => {
    const original = withDevelopmentBase(player, rules);
    const frozen = structuredClone(original);
    const renamed = {
      ...original,
      name: "Renamed",
      age: 35,
      clubId: "pal",
      developmentDelta: deltas,
    };
    expect(profileFor(renamed).attrs).toMatchObject(want);
    expect(matchProfileAttributes(renamed)).toEqual(want);
    expect(original).toEqual(frozen);
  });

  it("matches the complete profile across malformed ratings, imports and both save rules", () => {
    const inputs: Player[] = [
      player,
      { ...player, age: NaN, pace: Infinity, shooting: -10, passing: 400, physical: NaN },
      imported,
      { ...imported, developmentDelta: { technique: NaN, consistency: Infinity } },
      { ...imported, detailedAttributes: { ...imported.detailedAttributes!, technique: NaN } },
      ...([1, 2] as const).flatMap((rules) =>
        [player, imported, { ...imported, rosterSource: "custom" as const }].map((input) => ({
          ...withDevelopmentBase(input, rules),
          name: "Renamed after freezing",
          age: 40,
          developmentDelta: deltas,
        })),
      ),
    ];
    const sources: (AttributeSource | undefined)[] = [
      undefined,
      {},
      { attrDeltas: { [player.id]: { technique: -0.4, teamwork: 0.25, consistency: 1.2 } } },
    ];
    for (const input of inputs) {
      const before = structuredClone(input);
      for (const source of sources) {
        const { consistency, technique, teamwork, anticipation } = profileFor(input, source).attrs;
        expect(matchProfileAttributes(input, source)).toEqual({
          consistency,
          technique,
          teamwork,
          anticipation,
        });
      }
      expect(input).toEqual(before);
    }
  });
});
