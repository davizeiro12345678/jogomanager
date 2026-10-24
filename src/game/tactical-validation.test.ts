import { describe, expect, it } from "vitest";
import { FORMATION_KEYS } from "./formations";
import { activateAdvanced } from "./tactical-plan";
import { TacticalProgramSchema } from "./tactical-schema";
import { validTacticalProgram } from "./tactical-validation";

function fixture(formation = FORMATION_KEYS[0]!) {
  const p = activateAdvanced({
    formation,
    mentality: 2,
    pressing: 1,
    width: 1,
    tempo: 1,
  }).advanced!;
  p.plans[0]!.opposition = [{ playerId: "opponent", pressing: 1, marking: "zone", show: "inside" }];
  p.plans[0]!.setPieces.corners = ["corner"];
  p.plans[0]!.setPieces.freeKicks = ["free"];
  p.plans[0]!.setPieces.penalties = ["penalty"];
  p.rules = [
    {
      id: "rule",
      planId: p.activePlanId,
      enabled: true,
      priority: 10,
      minute: 65,
      score: "losing",
      fewerPlayers: false,
      conditionBelow: 50,
    },
  ];
  p.familiarity.roles = { player: 50 };
  p.familiarity.trainedRound = "2026:1";
  p.familiarity.played = ["2026:0"];
  return p;
}
const parity = (value: unknown, label: string) =>
  expect(validTacticalProgram(value), label).toBe(TacticalProgramSchema.safeParse(value).success);

describe("bounded worker tactical validation", () => {
  it("accepts every formation, preserving rich schema acceptance", () => {
    for (const formation of FORMATION_KEYS) {
      const p = fixture(formation);
      expect(validTacticalProgram(p)).toBe(true);
      parity(p, formation);
    }
  });
  it("matches the repair schema for recursive invalid fields and boundary values", () => {
    const original = fixture();
    let cases = 0;
    function visit(value: unknown, path: string[]) {
      const choices: unknown[] = [
        null,
        undefined,
        true,
        "",
        "unknown",
        -1,
        0,
        2,
        100,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
        [],
        {},
      ];
      if (Array.isArray(value)) choices.push(Array(101), [...value, ...value]);
      if (value && typeof value === "object" && !Array.isArray(value))
        choices.push({ ...value, unexpected: true });
      for (const replacement of choices) {
        const copy = structuredClone(original) as unknown as Record<string, unknown>;
        let parent = copy;
        for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
        parent[path.at(-1)!] = replacement;
        parity(copy, path.join(".") + "=" + String(replacement));
        cases++;
      }
      if (value && typeof value === "object")
        for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
    }
    for (const [key, child] of Object.entries(original)) visit(child, [key]);
    expect(cases).toBeGreaterThan(3000);
  });
  it("preserves reference and cross-field constraints", () => {
    for (const mutate of [
      (p: ReturnType<typeof fixture>) => {
        p.plans.push(structuredClone(p.plans[0]!));
      },
      (p: ReturnType<typeof fixture>) => {
        p.activePlanId = "missing";
      },
      (p: ReturnType<typeof fixture>) => {
        p.rules[0]!.planId = "missing";
      },
      (p: ReturnType<typeof fixture>) => {
        p.rules.push(structuredClone(p.rules[0]!));
      },
      (p: ReturnType<typeof fixture>) => {
        p.plans[0]!.players[1]!.slot = 0;
      },
      (p: ReturnType<typeof fixture>) => {
        p.plans[0]!.players[0]!.role = "striker";
      },
      (p: ReturnType<typeof fixture>) => {
        p.plans[0]!.players[0]!.duty = "attack";
      },
      (p: ReturnType<typeof fixture>) => {
        p.plans[0]!.id = "__proto__";
      },
      (p: ReturnType<typeof fixture>) => {
        p.familiarity.roles = Object.fromEntries(
          Array.from({ length: 201 }, (_, i) => [String(i), 50]),
        );
      },
    ]) {
      const p = fixture();
      mutate(p);
      expect(validTacticalProgram(p)).toBe(false);
      parity(p, String(mutate));
    }
    const p = fixture();
    Object.assign(p.plans[0]!.players[0]!.positions.won, { extra: true });
    parity(p, "coordinates retain non-strict object compatibility");
    expect(validTacticalProgram(p)).toBe(true);
  });
});
