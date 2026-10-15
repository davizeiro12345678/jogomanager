import { afterEach, describe, expect, it, vi } from "vitest";
import { boundedPhysicsInitialization, validExecutionContract } from "./match-execution";
import type { BallPhysicsAuthority } from "./rapier-ball-authority";
import { MatchSim, MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE } from "./sim";
import { buildTeamSetup } from "./quickMatch";
import { evaluatePassLanesIntoFallback } from "./wasm/match-perception";

function authority(step: BallPhysicsAuthority["step"] = vi.fn()): BallPhysicsAuthority {
  return { engine: "rapier-wasm", reset: vi.fn(), step, dispose: vi.fn() };
}
function match() {
  return new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "execution-v2");
}
afterEach(() => vi.useRealTimers());

describe("fixed match execution contract", () => {
  it("releases late initialization exactly once without attaching it", async () => {
    vi.useFakeTimers();
    let resolve!: (value: BallPhysicsAuthority) => void;
    const late = authority();
    const init = boundedPhysicsInitialization(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
      10,
    );
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);
    await expect(init).resolves.toBeNull();
    resolve(late);
    await Promise.resolve();
    await Promise.resolve();
    expect(late.dispose).toHaveBeenCalledTimes(1);
    expect(late.reset).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("settles initialization failure and cancels its deadline", async () => {
    vi.useFakeTimers();
    await expect(
      boundedPhysicsInitialization(async () => {
        throw new Error("WASM unavailable");
      }),
    ).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await expect(boundedPhysicsInitialization(async () => authority(), Infinity)).rejects.toThrow(
      /deadline/,
    );
  });
  it("cancels initialization on disposal and releases a subsequently resolved authority", async () => {
    vi.useFakeTimers();
    const cancel = new AbortController();
    const late = authority();
    let resolve!: (value: BallPhysicsAuthority) => void;
    const result = boundedPhysicsInitialization(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
      4000,
      cancel.signal,
    );
    await Promise.resolve();
    cancel.abort();
    expect(vi.getTimerCount()).toBe(0);
    await expect(result).resolves.toBeNull();
    resolve(late);
    await Promise.resolve();
    await Promise.resolve();
    expect(late.dispose).toHaveBeenCalledTimes(1);
  });
  it("rejects attaching or changing a backend after the first tick", () => {
    const sim = match();
    const late = authority();
    sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    expect(() => sim.setBallPhysicsAuthority(late)).toThrow(/fixed/);
    expect(() => sim.setPassLaneIntoKernel(evaluatePassLanesIntoFallback, "wasm")).toThrow(/fixed/);
    expect(late.reset).not.toHaveBeenCalled();
    expect(sim.executionContract()).toEqual({
      revision: 2,
      physics: "compat",
      perception: "compat",
    });
    late.dispose();
    sim.dispose();
  });
  it("does not downgrade physical rules after an authority trap", () => {
    const sim = match();
    const broken = authority(() => {
      throw new Error("trap");
    });
    sim.setBallPhysicsAuthority(broken);
    expect(() => sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE)).toThrow(/recovery/);
    expect(sim.executionContract().physics).toBe("rapier");
    expect(() => sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE)).toThrow(/recovery/);
    expect(() => sim.checkpoint()).toThrow(/recovery/);
    expect(broken.dispose).toHaveBeenCalledTimes(1);
    sim.dispose();
  });
  it("rejects incompatible checkpoint metadata before mutating state", () => {
    const sim = match();
    sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    const before = sim.checkpoint();
    expect(() =>
      sim.restoreCheckpoint({
        ...before,
        execution: { revision: 2, physics: "rapier", perception: "compat" },
      }),
    ).toThrow(/checkpoint/);
    expect(sim.checkpoint()).toEqual(before);
    expect(validExecutionContract({ revision: 999, physics: "compat", perception: "compat" })).toBe(
      false,
    );
    sim.dispose();
  });
  it("preserves state when speed groups the same fixed ticks", () => {
    const normal = match();
    const accelerated = match();
    for (let i = 0; i < 240; i++) normal.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    for (let batch = 0; batch < 30; batch++)
      for (let i = 0; i < 8; i++) accelerated.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    expect(accelerated.checkpoint()).toEqual(normal.checkpoint());
    normal.dispose();
    accelerated.dispose();
  });
});
