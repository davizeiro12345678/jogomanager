import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { withDevelopmentBase } from "./attributes";
import { pickLineup } from "./career-lineup";
import { buildReadySquad } from "./career-squad";
import { FORMATIONS } from "./formations";
import * as readiness from "./match-readiness";
import type { AttributeSource } from "./player-development";
import type { FormationKey, Player } from "./types";

function lineupCases(): { players: Player[]; source?: AttributeSource }[] {
  const squad = buildReadySquad("fla");
  const developed = squad.map((player) => withDevelopmentBase(player, 2));
  return [
    ...["fla", "pal", "bot", "cor_pr", "missing-lineup-club"].map((club) => ({
      players: buildReadySquad(club),
    })),
    { players: squad.slice(0, 7) },
    { players: squad.filter((player) => player.pos !== "GK") },
    { players: squad.map((player) => ({ ...player, pos: "GK" as const })) },
    { players: squad.map((player) => ({ ...player, suspended: true })) },
    {
      players: squad.map((player) => ({ ...player, ovr: 70, form: 60, condition: 100 })),
    },
    {
      players: squad.map((player, index) => ({
        ...player,
        ovr: index % 2 ? Number.NaN : Number.POSITIVE_INFINITY,
        condition: Number.NaN,
        form: Number.NEGATIVE_INFINITY,
      })),
    },
    {
      players: squad.map((player, index) => ({
        ...player,
        id: index < 2 ? "duplicate-id" : player.id,
      })),
    },
    { players: developed },
    { players: developed, source: {} },
    {
      players: developed,
      source: {
        attrDeltas: Object.fromEntries(
          developed.map((player, index) => [
            player.id,
            { finishing: index % 2 ? 12 : -4, reflexes: 5, passing: 7 },
          ]),
        ),
      },
    },
    { players: [] },
  ];
}

describe("career lineup rating reuse", () => {
  it("evaluates each eligible player's selection rating only once per call", () => {
    const squad = buildReadySquad("fla");
    squad[0]!.suspended = true;
    squad[1]!.injuryWeeks = 2;
    const eligible = squad.filter((player) => !player.suspended && player.injuryWeeks === 0);
    const rating = vi.spyOn(readiness, "selectionRating");
    try {
      pickLineup(squad, "4-3-3");
      expect(rating).toHaveBeenCalledTimes(eligible.length);
    } finally {
      rating.mockRestore();
    }
  });

  it("preserves baseline lineups and benches across all formations and supported malformed inputs", () => {
    const outputs: string[] = [];
    for (const input of lineupCases())
      for (const formation of [...Object.keys(FORMATIONS), "corrupt-formation"])
        outputs.push(
          JSON.stringify(pickLineup(input.players, formation as FormationKey, input.source)),
        );
    expect(outputs).toHaveLength(80);
    expect(createHash("sha256").update(outputs.join("\n")).digest("hex")).toBe(
      "044281b94aeafe16b0622fe50bf38fa4d28537ba5cd7a554e46a53f9f449f845",
    );
  });

  it("does not mutate or retain input state when a player or explicit career source changes", () => {
    const players = buildReadySquad("fla").map((player) =>
      withDevelopmentBase(
        {
          ...player,
          ovr: 70,
          pace: 70,
          shooting: 70,
          passing: 70,
          defending: 70,
          physical: 70,
          form: 60,
          condition: 100,
        },
        2,
      ),
    );
    const source: AttributeSource = { attrDeltas: {} };
    const before = structuredClone(players);
    const first = pickLineup(players, "4-3-3", source);
    expect(players).toEqual(before);
    const copied = pickLineup(structuredClone(players), "4-3-3", structuredClone(source));
    expect(copied).toEqual(first);
    expect(copied.lineup).not.toBe(first.lineup);
    expect(copied.bench).not.toBe(first.bench);
    first.lineup.splice(0);
    first.bench.splice(0);
    expect(pickLineup(players, "4-3-3", source)).toEqual(copied);

    const boosted = players.find(
      (player) => player.pos === "FW" && !copied.lineup.includes(player.id),
    )!;
    source.attrDeltas![boosted.id] = Object.fromEntries(
      Object.keys(boosted.developmentBase!.profile.attrs).map((key) => [key, 30]),
    );
    const changed = pickLineup(players, "4-3-3", source);
    expect(changed.lineup).toContain(boosted.id);
    expect(changed.lineup).not.toEqual(copied.lineup);
    expect(changed).toEqual(pickLineup(structuredClone(players), "4-3-3", structuredClone(source)));
    expect(players).toEqual(before);
    expect(pickLineup(players, "4-3-3", {})).toEqual(copied);
  });
});
