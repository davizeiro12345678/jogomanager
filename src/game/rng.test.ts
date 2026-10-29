import { describe, expect, it } from "vitest";
import { hashSeed, makeRng } from "./rng";

// Previous unsigned-state implementation, retained only as an independent
// compatibility oracle for saved match checkpoints and existing seeds.
function referenceRng(seed: number | string) {
  let s = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

describe("deterministic match random stream", () => {
  it("preserves every draw from the previous unsigned-state stream", () => {
    const seeds: Array<string | number> = [
      "",
      "bench-rng",
      "ação-😀",
      0,
      1,
      -1,
      2 ** 31,
      2 ** 32 - 1,
      2 ** 32,
      NaN,
      Infinity,
      ...Array.from({ length: 64 }, (_, index) => `seed-${index}`),
    ];
    for (const seed of seeds) {
      const actual = makeRng(seed);
      const expected = referenceRng(seed);
      for (let draw = 0; draw < 2_000; draw++) expect(actual()).toBe(expected());
    }
  });

  it("restores the exact next draw and exposes unsigned checkpoint states", () => {
    for (const state of [0, 1, 2 ** 31 - 1, 2 ** 31, 2 ** 32 - 1]) {
      const original = makeRng("checkpoint");
      original.restore(state);
      expect(original.state()).toBe(state);
      const checkpoint = original.state();
      const resumed = makeRng("different seed");
      resumed.restore(checkpoint);
      for (let draw = 0; draw < 100; draw++) {
        expect(resumed()).toBe(original());
        expect(resumed.state()).toBe(original.state());
      }
    }
  });

  it("rejects invalid checkpoints without modifying the active stream", () => {
    for (const value of [-1, 0.5, 2 ** 32, NaN, Infinity]) {
      const random = makeRng("checkpoint");
      const before = random.state();
      expect(() => random.restore(value)).toThrow("Invalid PRNG state");
      expect(random.state()).toBe(before);
    }
  });
});
