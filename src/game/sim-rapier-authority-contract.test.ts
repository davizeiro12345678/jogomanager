import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import type {
  BallPhysicsAuthority,
  RapierBallHolder,
  RapierBallState,
} from "./rapier-ball-authority";

function createSim(seed = "rapier-authority-contract") {
  return new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed);
}

describe("MatchSim Rapier authority contract", () => {
  it("uses the injected physical ball state before applying football rules", () => {
    const sim = createSim();
    const calls: Array<{ state: RapierBallState; holder: RapierBallHolder | null }> = [];
    let resets = 0;
    const authority: BallPhysicsAuthority = {
      engine: "rapier-wasm",
      reset: () => {
        resets += 1;
      },
      step: (_dt, state, holder) => {
        calls.push({ state: { ...state }, holder: holder ? { ...holder } : null });
        state.x = (holder?.x ?? state.x) + 1.75;
        state.z = (holder?.z ?? state.z) - 0.45;
        state.height = 0.34;
        state.vx = 5.25;
        state.vy = 1.1;
        state.vz = -0.8;
        state.spin = 2.4;
      },
      dispose: () => undefined,
    };

    sim.setBallPhysicsAuthority(authority);
    const holderId = sim.ball.holder;
    sim.step(1 / 30);

    expect(resets).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.holder?.id).toBe(holderId);
    expect(sim.ball.holder).toBe(holderId);
    expect(sim.ball).toMatchObject({
      x: calls[0]!.holder!.x + 1.75,
      z: calls[0]!.holder!.z - 0.45,
    });
    expect(sim.physicsBallState()).toMatchObject({
      height: 0.34,
      vx: 5.25,
      vy: 1.1,
      vz: -0.8,
      spin: 2.4,
    });
  });

  it("keeps fast-forward on the deterministic compatibility path and rebaseable", () => {
    const sim = createSim("rapier-skip-contract");
    let steps = 0;
    let resets = 0;
    const authority: BallPhysicsAuthority = {
      engine: "rapier-wasm",
      reset: () => {
        resets += 1;
      },
      step: () => {
        steps += 1;
      },
      dispose: () => undefined,
    };

    sim.setBallPhysicsAuthority(authority);
    sim.step(0.4, 1, false);
    expect(steps).toBe(0);

    sim.synchronizeBallPhysics();
    expect(resets).toBe(2);
  });
});
