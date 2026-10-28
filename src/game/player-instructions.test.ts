import { describe, expect, it, vi } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { FIELD_X, MatchSim, type SimPlayer } from "./sim";
import { xgForShot } from "./sim-rules";

describe("AI player instructions", () => {
  it("changes an attacker's actual shot decision while using the same state and random roll", () => {
    function decision(style: "cautious" | "attacking") {
      const home = buildTeamSetup("fla");
      home.tactics.playerInstructions = {
        GK: "balanced",
        DF: "balanced",
        MF: "balanced",
        FW: style,
      };
      const sim = new MatchSim(home, buildTeamSetup("pal"), "instructions-comparison");
      const attacker = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
      attacker.x = FIELD_X - 20;
      attacker.z = 0;
      attacker.vx = 0;
      attacker.vz = 0;
      for (const player of sim.players)
        if (player.side === "away") {
          player.x = -FIELD_X;
          player.z = 0;
        }
      const internal = sim as unknown as {
        rnd: () => number;
        nearestOpponent: (p: SimPlayer) => { dist: number };
        decide: (p: SimPlayer) => void;
        shoot: (p: SimPlayer, distance: number) => void;
      };
      const pressDist = internal.nearestOpponent(attacker).dist;
      const chance = xgForShot({ dist: 20, wide: 0, bodyPart: "foot", pressDist, onRun: false });
      const threshold =
        Math.min(0.72, chance * 2.4) *
        (0.8 + attacker.shooting / 500) *
        (0.9 + home.tactics.mentality * 0.05);
      internal.rnd = () => threshold;
      const shot = vi.spyOn(internal, "shoot").mockImplementation(() => undefined);
      internal.decide(attacker);
      return shot.mock.calls.length;
    }
    expect(decision("cautious")).toBe(0);
    expect(decision("attacking")).toBe(1);
  });
});
