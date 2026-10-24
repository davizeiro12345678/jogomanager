import { expect, it } from "vitest";
import { FIELD_X, FIELD_Z, MatchSim } from "./sim";
import { buildTeamSetup } from "./quickMatch";

it("preserves finite clamps, invalid-data fallbacks and signed zero", () => {
  const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "sanitize");
  const legacy = (value: number, lower: number, upper: number, fallback: number) =>
    Math.max(lower, Math.min(upper, Number.isFinite(value) ? value : fallback));
  try {
    for (const value of [NaN, Infinity, -Infinity, -1e100, 1e100, -0, 0, 0.12, 12, 14, 100]) {
      const player = sim.players[0]!;
      player.x = player.z = player.vx = player.vz = player.stamina = value;
      sim.ball.x = sim.ball.z = sim.ball.vx = sim.ball.vz = sim.ball.height = value;
      (sim as unknown as { sanitize(): void }).sanitize();
      expect(player.x).toBe(legacy(value, -FIELD_X - 1, FIELD_X + 1, 0));
      expect(player.z).toBe(legacy(value, -FIELD_Z - 1, FIELD_Z + 1, 0));
      expect(player.vx).toBe(legacy(value, -14, 14, 0));
      expect(player.vz).toBe(legacy(value, -14, 14, 0));
      expect(player.stamina).toBe(legacy(value, 0, 100, 70));
      expect(sim.ball.x).toBe(legacy(value, -FIELD_X - 2, FIELD_X + 2, 0));
      expect(sim.ball.z).toBe(legacy(value, -FIELD_Z - 2, FIELD_Z + 2, 0));
      expect(sim.ball.vx).toBe(legacy(value, -45, 45, 0));
      expect(sim.ball.vz).toBe(legacy(value, -45, 45, 0));
      expect(sim.ball.height).toBe(legacy(value, 0.1, 12, 0.12));
    }
  } finally {
    sim.dispose();
  }
});
