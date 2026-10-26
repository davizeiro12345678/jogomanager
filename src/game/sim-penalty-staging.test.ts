import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim, FIELD_X, FIELD_Z } from "./sim";
import { BOX_DEPTH, BOX_HALF, PENALTY_DIST } from "./sim-rules";
import type { Side } from "./sim-types";

describe("penalty positions before release", () => {
  it.each<Side>(["home", "away"])("stages a legal %s penalty", (side) => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "penalty-staging");
    const internal = sim as unknown as {
      setupPenalty(side: Side): void;
      setPiece: { takerId: string };
    };
    const dir = side === "home" ? 1 : -1;
    const goalX = dir * FIELD_X;
    const markX = goalX - dir * PENALTY_DIST;
    // A real contact in front of the mark must not send a defender closer to goal.
    for (const [index, player] of sim.players.entries()) {
      player.x = markX + dir * (index % 2 ? 1.5 : -1.5);
      player.z = (index % 5) - 2;
    }
    internal.setupPenalty(side);
    const taker = sim.players.find((player) => player.id === internal.setPiece.takerId)!;
    const keeper = sim.players.find((player) => player.side !== side && player.pos === "GK")!;
    expect.soft(keeper.x).toBe(goalX);
    expect(keeper.z).toBe(0);
    expect(taker.x).toBe(markX);
    for (const player of sim.players) {
      if (player === taker || player === keeper || player.sentOff) continue;
      expect.soft(player.x * dir).toBeLessThan(markX * dir);
      expect
        .soft(Math.abs(player.x - goalX) >= BOX_DEPTH || Math.abs(player.z) >= BOX_HALF)
        .toBe(true);
      expect.soft(Math.hypot(player.x - markX, player.z)).toBeGreaterThanOrEqual(9.15);
      expect(Math.abs(player.x)).toBeLessThanOrEqual(FIELD_X);
      expect(Math.abs(player.z)).toBeLessThanOrEqual(FIELD_Z);
    }
    sim.dispose();
  });
});
