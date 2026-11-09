import { describe, expect, it } from "vitest";
import { CLUBS } from "../data/leagues";
import { CanonicalAuthoritativeMatchEngine } from "./canonical-authoritative-engine.server";
import { parseMatchSnapshotV1 } from "./match-protocol";

const clubs = Object.keys(CLUBS).slice(0, 2);
const seed = "test-authoritative-seed-v2-0001";

function createEngine() {
  return new CanonicalAuthoritativeMatchEngine(clubs[0]!, clubs[1]!, seed);
}

const defaultTactics = {
  formation: "4-3-3",
  mentality: "balanced",
  pressing: "high",
  width: "wide",
  tempo: "fast",
  lineHeight: "standard",
} as const;

describe("Canonical server-only authoritative engine", () => {
  it("rejects non-canonical club IDs and malformed private seeds", () => {
    expect(() => new CanonicalAuthoritativeMatchEngine("__unknown__", clubs[1]!, seed)).toThrow();
    expect(() => new CanonicalAuthoritativeMatchEngine(clubs[0]!, clubs[1]!, "bad")).toThrow();
  });

  it("repeats the same fixed-step simulation and publishes no private seed", () => {
    const left = createEngine();
    const right = createEngine();
    try {
      for (let step = 0; step < 90; step += 1) {
        left.advanceFixedStep();
        right.advanceFixedStep();
      }
      expect(left.publicState()).toEqual(right.publicState());
      expect(left.presentationEvents()).toEqual(right.presentationEvents());
      expect(JSON.stringify(left.publicState())).not.toContain(seed);
      const state = left.publicState();
      expect(state.possession.home + state.possession.away).toBe(100);
      parseMatchSnapshotV1({
        version: 1,
        roomId: "45fd1d08-4f81-44bc-9072-1e35ce9d1d94",
        tick: 90,
        revision: 90,
        phase: "live",
        publicState: state,
        presentationEvents: left.presentationEvents(),
      });
    } finally {
      left.dispose();
      right.dispose();
    }
  });

  it("maps only supported tactical instructions and rejects silent feature downgrades", () => {
    const engine = createEngine();
    try {
      expect(engine.applyTactics("home", defaultTactics)).toBe(true);
      expect(engine.sim.home.tactics).toMatchObject({
        mentality: 2,
        pressing: 2,
        width: 2,
        tempo: 2,
      });
      expect(engine.applyTactics("home", { ...defaultTactics, formation: "4-4-2" })).toBe(false);
      expect(engine.applyTactics("home", { ...defaultTactics, lineHeight: "high" })).toBe(false);
      expect(
        engine.applyTactics("home", {
          ...defaultTactics,
          outOfPossession: ["offside_trap"],
        }),
      ).toBe(false);
    } finally {
      engine.dispose();
    }
  });

  it("accepts only registered substitutes, not injected roster values", () => {
    const engine = createEngine();
    try {
      const outgoing = engine.sim.players.find((player) => player.side === "home")!;
      const registered = engine.sim.home.bench?.[0];
      if (!registered) throw new Error("a canonical match must have bench players");
      expect(engine.substitute("home", outgoing.pid, "foreign-player")).toBe(false);
      expect(engine.substitute("away", outgoing.pid, registered.id)).toBe(false);
      if (registered) {
        expect(engine.substitute("home", outgoing.pid, registered.id)).toBe(true);
        expect(engine.substitute("home", outgoing.pid, registered.id)).toBe(false);
      }
    } finally {
      engine.dispose();
    }
  });

  it("issues internally consistent scores and a deterministic forfeit", () => {
    const engine = createEngine();
    try {
      expect(engine.finalResult("home")).toEqual({
        homeGoals: 0,
        awayGoals: 3,
        winner: "away",
      });
      expect(engine.finalResult("away")).toEqual({
        homeGoals: 3,
        awayGoals: 0,
        winner: "home",
      });
      const result = engine.finalResult();
      expect(result.winner).toBe(
        result.homeGoals === result.awayGoals
          ? "draw"
          : result.homeGoals > result.awayGoals
            ? "home"
            : "away",
      );
    } finally {
      engine.dispose();
    }
  });
});
