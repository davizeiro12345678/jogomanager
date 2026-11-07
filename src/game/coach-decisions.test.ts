import { describe, expect, it } from "vitest";
import { initCareer, migrateCareer } from "./career";
import { applyCoachDecision, coachDecision } from "./coach-decisions";
import { practicedCareerLessons } from "./career-tutorial";
import { recordWorldMatch } from "./career-world";

describe("contextual coach decisions", () => {
  const starter = () => initCareer("bra", "fla", "Teste da carreira");

  it("applies distinct tradeoffs and persists a single receipt for the round", async () => {
    const career = { ...starter(), pressure: 75, approval: 55, fanApproval: 55 };
    const event = coachDecision(career)!;
    const board = applyCoachDecision(career, event.id, "targets");
    const squad = applyCoachDecision(career, event.id, "back-squad");
    expect(board.approval).toBe(60);
    expect(board.pressure).toBe(71);
    expect(squad.fanApproval).toBe(58);
    expect(squad.approval).toBe(52);
    const reloaded = await migrateCareer(JSON.parse(JSON.stringify(board)));
    expect(coachDecision(reloaded)).toBeNull();
    expect(applyCoachDecision(reloaded, event.id, "back-squad")).toBe(reloaded);
    expect(practicedCareerLessons(reloaded).has("coach-decisions")).toBe(true);
    expect(board.achievements).toEqual(career.achievements);
  });

  it("reviews the board target once from the real saved match result", () => {
    const base = { ...starter(), pressure: 75, approval: 55 };
    const event = coachDecision(base)!;
    const promised = applyCoachDecision(base, event.id, "targets");
    const match = {
      season: base.season,
      round: base.round,
      opponentId: "vas",
      home: true,
      comp: "Liga" as const,
      gf: 0,
      ga: 1,
      players: [],
    };
    const lost = recordWorldMatch(promised, match);
    const drew = recordWorldMatch(promised, { ...match, ga: 0 });
    expect(lost.approval).toBe(promised.approval - 5);
    expect(drew.approval).toBe(promised.approval + 3);
    expect(lost.world?.memories[0]?.id).toBe(event.id + ":review");
    expect(recordWorldMatch(lost, match)).toBe(lost);
  });

  it("prioritizes fatigue, changes only the active club and bounds the result", () => {
    const base = starter();
    const players = Object.fromEntries(
      Object.values(base.players).map((player) => [player.id, { ...player, condition: 60 }]),
    );
    const other = {
      ...Object.values(base.players)[0]!,
      id: "other-club",
      clubId: "flu",
      condition: 99,
    };
    const career = { ...base, pressure: 45, players: { ...players, [other.id]: other } };
    const event = coachDecision(career)!;
    expect(event.category).toBe("Comissão técnica");
    const next = applyCoachDecision(career, event.id, "lighter");
    expect(next.players[other.id]).toBe(other);
    expect(
      Object.values(next.players)
        .filter((player) => player.clubId === "fla")
        .every((p) => p.condition === 65),
    ).toBe(true);
    expect(applyCoachDecision(career, event.id, "unknown")).toBe(career);
    expect(applyCoachDecision(career, event.id + ":old", "lighter")).toBe(career);
  });

  it("recognizes an unsettled athlete and supports saves without a career world", () => {
    const base = starter();
    delete base.world;
    const player = Object.values(base.players).find((candidate) => candidate.clubId === "fla")!;
    const career = {
      ...base,
      pressure: 45,
      players: { ...base.players, [player.id]: { ...player, unhappy: true } },
    };
    const event = coachDecision(career)!;
    expect(event.playerId).toBe(player.id);
    expect(applyCoachDecision(career, event.id, "listen").world?.memories[0]?.playerId).toBe(
      player.id,
    );
  });
});
