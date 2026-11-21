import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { poolForLeague } from "./data/names";
import * as random from "./rng";
import { buildSquad, completeSquad, safeClub } from "./squad";
import type { Player } from "./types";

function reserveCases(clubId: string): { existing: Player[]; minimum: number }[] {
  const squad = buildSquad(clubId);
  const plain = squad.slice(0, 18);
  return [
    { existing: [], minimum: 0 },
    { existing: [], minimum: 26 },
    { existing: plain, minimum: 26 },
    { existing: plain.slice(0, 7), minimum: 26 },
    { existing: squad, minimum: 26 },
    { existing: squad, minimum: 30 },
    { existing: plain.filter((player) => player.pos !== "GK"), minimum: 26 },
    { existing: plain.map((player) => ({ ...player, pos: "GK" as const })), minimum: 26 },
    {
      existing: plain.map((player) => ({ ...player, pos: "DF" as const })),
      minimum: 26,
    },
    {
      existing: plain.map((player, index) => ({
        ...player,
        id: index < 2 ? `${clubId}-reserve-0` : player.id,
        number: index < 2 ? 1 : player.number,
      })),
      minimum: 26,
    },
    {
      existing: plain.map((player, index) => ({
        ...player,
        age: Number.NaN,
        ovr: Number.POSITIVE_INFINITY,
        number: index % 2 ? Number.NaN : Number.POSITIVE_INFINITY,
      })),
      minimum: 26,
    },
    {
      existing: Array.from({ length: 99 }, (_, index) => ({
        ...squad[index % squad.length]!,
        id: `numbered-${index}`,
        number: index + 1,
      })),
      minimum: 100,
    },
    { existing: plain, minimum: Number.NaN },
    { existing: plain, minimum: -1 },
  ];
}

describe("reserve generation work and deterministic ownership", () => {
  it("preserves RNG draws including the unsuccessful attempt when no shirt remains", () => {
    const original = random.makeRng;
    const squad = buildSquad("fla");
    const existing = squad.slice(0, 18);
    const exhausted = Array.from({ length: 99 }, (_, index) => ({
      ...squad[index % squad.length]!,
      id: `exhausted-${index}`,
      number: index + 1,
    }));
    const traces: { seed: number | string; draws: number }[] = [];
    const makeRng = vi.spyOn(random, "makeRng").mockImplementation((seed) => {
      const source = original(seed);
      const trace = { seed, draws: 0 };
      traces.push(trace);
      const next = () => {
        trace.draws++;
        return source();
      };
      next.state = source.state;
      next.restore = source.restore;
      return next;
    });
    try {
      completeSquad("fla", existing);
      completeSquad("fla", exhausted, 100);
    } finally {
      makeRng.mockRestore();
    }
    expect(traces).toEqual([
      { seed: "squad-reserves-fla", draws: 88 },
      { seed: "squad-reserves-fla", draws: 4 },
    ]);
  });

  it("finds free shirt numbers without allocating a 99-entry candidate array per reserve", () => {
    const existing = buildSquad("fla").slice(0, 18);
    const from = vi.spyOn(Array, "from");
    let fullShirtArrays: number;
    try {
      completeSquad("fla", existing);
      fullShirtArrays = from.mock.calls.filter(
        ([value]) => value && typeof value === "object" && "length" in value && value.length === 99,
      ).length;
    } finally {
      from.mockRestore();
    }
    expect(fullShirtArrays).toBe(0);
  });

  it("preserves complete baseline output with ties, duplicate IDs, invalid ratings and exhausted shirts", () => {
    const outputs: string[] = [];
    for (const clubId of ["fla", "pal", "bot", "rma", "bay", "psg", "missing-reserve-club"])
      for (const input of reserveCases(clubId))
        outputs.push(JSON.stringify(completeSquad(clubId, input.existing, input.minimum)));
    expect(outputs).toHaveLength(98);
    expect(createHash("sha256").update(outputs.join("\n")).digest("hex")).toBe(
      "bae47da66d9d2e1c3dae7a44d927214dd52c1946dc78093b549e4f13d3385d1e",
    );
  });

  it("retains existing player references without mutating them or sharing new reserves between calls", () => {
    const existing = buildSquad("fla").slice(0, 18);
    const before = structuredClone(existing);
    const pool = poolForLeague(safeClub("fla").league);
    const firstNames = pool.first;
    const lastNames = pool.last;
    const poolBefore = structuredClone(pool);
    const first = completeSquad("fla", existing);
    const second = completeSquad("fla", existing);
    expect(first).toEqual(second);
    expect(first).not.toBe(existing);
    expect(first).not.toBe(second);
    expect(existing).toEqual(before);
    expect(pool).toEqual(poolBefore);
    expect(poolForLeague(safeClub("fla").league)).toBe(pool);
    expect(pool.first).toBe(firstNames);
    expect(pool.last).toBe(lastNames);
    for (let index = 0; index < existing.length; index++)
      expect(first[index]).toBe(existing[index]);
    for (let index = existing.length; index < first.length; index++)
      expect(first[index]).not.toBe(second[index]);
    first.at(-1)!.name = "Local mutation";
    expect(second.at(-1)!.name).not.toBe("Local mutation");
    expect(completeSquad("fla", existing)).toEqual(second);
    expect(pool).toEqual(poolBefore);
  });
});
