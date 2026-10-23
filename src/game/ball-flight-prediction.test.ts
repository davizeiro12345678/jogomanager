import { describe, expect, it } from "vitest";
import { createRapierBallAuthority, type RapierBallState } from "./rapier-ball-authority";
import { BALL_FLIGHT_PREDICTION_TICKS } from "./ball-flight-prediction";

describe("independent ball-flight probe", () => {
  it("bounds and repeats prediction without mutating or observing the live world", async () => {
    let liveCalls = 0;
    const live = await createRapierBallAuthority({ observeSubstep: () => liveCalls++ });
    const initial: RapierBallState = {
      x: 25,
      z: 3,
      height: 0.25,
      vx: 18,
      vy: 8,
      vz: -2,
      spin: 1,
      holder: null,
    };
    live.setCondition!("rain", { x: 0.3, z: -0.2 });
    live.reset(initial);
    const before = live.checkpoint!();
    const probe = live.createFlightProbe!();
    try {
      const first = probe.sample(initial),
        second = probe.sample(initial);
      expect(first).toHaveLength(BALL_FLIGHT_PREDICTION_TICKS + 1);
      expect(second).toEqual(first);
      expect(live.checkpoint!()).toEqual(before);
      expect(liveCalls).toBe(0);
      expect(initial).toEqual({
        x: 25,
        z: 3,
        height: 0.25,
        vx: 18,
        vy: 8,
        vz: -2,
        spin: 1,
        holder: null,
      });
      probe.dispose();
      probe.dispose();
      expect(() => probe.sample(initial)).toThrow(/disposed/);
      live.step(1 / 30, initial, null);
      expect(liveCalls).toBeGreaterThan(0);
      expect(initial.x).toBeGreaterThan(25);
    } finally {
      probe.dispose();
      live.dispose();
    }
  });
});
