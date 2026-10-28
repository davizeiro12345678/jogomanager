import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "../quickMatch";
import { TacticalCommandPayloadV1Schema } from "./match-protocol";
import { MatchSimAuthority } from "./match-sim-authority.server";

const tactics = TacticalCommandPayloadV1Schema.parse({
  formation: "4-3-3",
  mentality: "positive",
  pressing: "high",
  width: "wide",
  tempo: "fast",
  lineHeight: "standard",
});

describe("authoritative MatchSim adapter", () => {
  it("advances the real simulation from a server-provided seed without exposing it", () => {
    const engine = new MatchSimAuthority("fla", "pal", "private-server-seed-123", false);
    const before = engine.visualSnapshot();
    for (let i = 0; i < 30; i++) engine.advanceFixedStep();
    const after = engine.visualSnapshot();
    expect(after.time).toBeGreaterThan(before.time);
    expect(after.players).toHaveLength(22);
    expect(JSON.stringify(after)).not.toContain("private-server-seed-123");
    expect(engine.publicState().possession.home + engine.publicState().possession.away).toBe(100);
    expect(() => engine.finalResult()).toThrow(/unfinished/);
  });

  it("accepts only supported tactics and server-known reserves belonging to the correct side", () => {
    const engine = new MatchSimAuthority("fla", "pal", "private-server-seed-123", true);
    expect(engine.applyTactics("home", tactics)).toBe(true);
    expect(engine.applyTactics("home", { ...tactics, formation: "5-3-2" })).toBe(false);
    expect(engine.applyTactics("home", { ...tactics, lineHeight: "high" })).toBe(false);
    const home = buildTeamSetup("fla");
    const away = buildTeamSetup("pal");
    expect(engine.substitute("home", home.players[0]!.id, away.bench![0]!.id)).toBe(false);
    expect(engine.substitute("home", home.players[0]!.id, home.bench![0]!.id)).toBe(true);
    expect(engine.substitute("home", home.players[0]!.id, home.bench![1]!.id)).toBe(false);
  });

  it("rejects invalid catalog clubs and never accepts a missing seed", () => {
    expect(
      () => new MatchSimAuthority("constructor", "pal", "private-server-seed-123", false),
    ).toThrow();
    expect(() => new MatchSimAuthority("fla", "pal", "short", false)).toThrow();
  });
});
