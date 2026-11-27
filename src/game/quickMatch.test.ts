import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";

describe("quick match team setup", () => {
  it("does not share mutable players, bench, or tactics between matches", () => {
    const original = buildTeamSetup("fla");
    const playing = buildTeamSetup("fla");
    playing.players[0]!.morale = 0;
    playing.bench?.pop();
    playing.tactics.pressing = 2;
    expect(buildTeamSetup("fla")).toEqual(original);
  });

  it("preserves alternate formations, bench order, and per-match tactics", () => {
    const baseline = buildTeamSetup("pal", "4-4-2");
    const changed = buildTeamSetup("pal", "4-4-2", 3, 2, {
      cpu: false,
      morale: 42,
      tacticalAiRevision: 2,
    });
    expect(changed.players).toEqual(baseline.players);
    expect(changed.bench).toEqual(baseline.bench);
    expect(changed).toMatchObject({
      cpu: false,
      morale: 42,
      tacticalAiRevision: 2,
      tactics: { formation: "4-4-2", mentality: 3, pressing: 2 },
    });
    buildTeamSetup("pal", "3-5-2");
    expect(buildTeamSetup("pal", "4-4-2")).toEqual(baseline);
  });
});
