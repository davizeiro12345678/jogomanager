import { describe, it, expect } from "vitest";
import { advanceCrowdBehavior, createCrowdBehavior } from "./crowd-motion";
import type { SimView } from "./sim-types";
function fixture(minute = 20) {
  const stat = () => ({ goals: 0, onTarget: 0, yellow: 0, red: 0, fouls: 0 });
  return { stats: { home: stat(), away: stat() }, minute: () => minute } as unknown as SimView;
}
describe("crowd reacts to authoritative view counters", () => {
  it.each(["home", "away"] as const)("targets the %s scoring side for sector reactions", (side) => {
    const sim = fixture();
    const state = createCrowdBehavior();
    advanceCrowdBehavior(state, sim, 1 / 60);
    sim.stats[side].goals = 1;
    advanceCrowdBehavior(state, sim, 1 / 60);
    expect(state.behavior).toBe("celebrate");
    expect(state.side).toBe(side);
    expect(sim.stats.home.goals).toBe(side === "home" ? 1 : 0);
    expect(sim.stats.away.goals).toBe(side === "away" ? 1 : 0);
  });
  it("does not celebrate old goals when a replay or scene mounts", () => {
    const sim = fixture();
    sim.stats.home.goals = 3;
    const state = createCrowdBehavior();
    advanceCrowdBehavior(state, sim, 1 / 60);
    expect(state.behavior).toBe("chant");
  });
  it("identifies the new shot rather than the side with higher historical totals", () => {
    const sim = fixture();
    sim.stats.home.onTarget = 8;
    const state = createCrowdBehavior();
    advanceCrowdBehavior(state, sim, 1 / 60);
    sim.stats.away.onTarget = 1;
    advanceCrowdBehavior(state, sim, 1 / 60);
    expect(state.behavior).toBe("gasp");
    expect(state.side).toBe("away");
  });
  it("protects a goal celebration from a lower priority foul and then settles", () => {
    const sim = fixture(),
      state = createCrowdBehavior();
    advanceCrowdBehavior(state, sim, 1 / 60);
    sim.stats.away.goals++;
    advanceCrowdBehavior(state, sim, 1 / 60);
    sim.stats.home.fouls++;
    advanceCrowdBehavior(state, sim, 1 / 60);
    expect(state.behavior).toBe("celebrate");
    expect(state.side).toBe("away");
    for (let i = 0; i < 800; i++) advanceCrowdBehavior(state, sim, 1 / 60);
    expect(state.behavior).toBe("chant");
  });
  it("selects a timed wave and leading-side taunt without changing match state", () => {
    const wave = fixture(18),
      state = createCrowdBehavior();
    const before = JSON.stringify(wave.stats);
    advanceCrowdBehavior(state, wave, 0);
    state.age = 13;
    advanceCrowdBehavior(state, wave, 0);
    expect(state.behavior).toBe("wave");
    expect(JSON.stringify(wave.stats)).toBe(before);
    const leading = fixture(24);
    leading.stats.home.goals = 1;
    const taunt = createCrowdBehavior();
    advanceCrowdBehavior(taunt, leading, 0);
    taunt.age = 13;
    advanceCrowdBehavior(taunt, leading, 0);
    expect(taunt.behavior).toBe("taunt");
  });
  it("reacts as soon as the supporter climate turns to protest", () => {
    const sim = fixture(),
      state = createCrowdBehavior();
    advanceCrowdBehavior(state, sim, 1 / 60, {
      occupancy: 0.9,
      climate: "apoio",
      side: "home",
      intensity: 0.3,
    });
    advanceCrowdBehavior(state, sim, 1 / 60, {
      occupancy: 0.9,
      climate: "protesto",
      side: "home",
      intensity: 0.7,
    });
    expect(state.behavior).toBe("boo");
    expect(state.intensity).toBeCloseTo(0.7 - (1 / 60) * 0.35);
  });
});
