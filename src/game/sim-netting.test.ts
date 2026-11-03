import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { FIELD_X, MatchSim } from "./sim";
import { GOAL_Z } from "./sim-rules";

describe("side netting is solid", () => {
  it("pushes a player standing in the side net back out", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "netting");
    const p = sim.players[3]!;
    p.x = FIELD_X + 0.6;
    p.z = GOAL_Z + 0.05;
    p.vx = 0;
    p.vz = 0;
    (sim as unknown as { separate(): void }).separate();
    expect(Math.abs(Math.abs(p.z) - GOAL_Z)).toBeGreaterThanOrEqual(0.37);
  });
});
