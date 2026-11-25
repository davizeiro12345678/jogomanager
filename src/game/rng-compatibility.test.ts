import { describe, expect, it } from "vitest";
import { hashSeed, makeRng } from "./rng";

// Reference is the previously integrated signed-state implementation. The
// unsigned representation must retain the exact historical arithmetic shift.
function signedReference(seed: number | string) {
  let s = (typeof seed === "string" ? hashSeed(seed) : seed) | 0;
  if (s === 0) s = 0x9e3779b9 | 0;
  return {
    next() {
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    },
    state: () => s >>> 0,
    restore: (state: number) => {
      s = state | 0;
    },
  };
}

describe("deterministic PRNG representation compatibility", () => {
  it("preserves one million historical draws and checkpoints exactly", () => {
    const seeds: (number | string)[] = [
      0,
      1,
      -1,
      0x80000000,
      0xffffffff,
      0x100000000,
      NaN,
      Infinity,
      "bench-rng",
      "",
      "Vitória",
      "⚽",
      ...Array.from({ length: 88 }, (_, i) => Math.imul(i + 1, 0x9e3779b9)),
    ];
    let mismatches = 0;
    for (const seed of seeds) {
      const actual = makeRng(seed);
      const expected = signedReference(seed);
      for (let i = 0; i < 10_000; i++) {
        if (actual() !== expected.next() || actual.state() !== expected.state()) mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });
  it("resumes unsigned, high-bit, and zero states without changing the sequence", () => {
    for (const state of [0, 1, 0x7fffffff, 0x80000000, 0xffffffff]) {
      const actual = makeRng(1);
      const expected = signedReference(1);
      actual.restore(state);
      expected.restore(state);
      expect(actual.state()).toBe(state);
      for (let i = 0; i < 100; i++) {
        expect(actual()).toBe(expected.next());
        expect(actual.state()).toBe(expected.state());
      }
    }
    const actual = makeRng(1);
    for (const invalid of [-1, 0x100000000, NaN, Infinity, 1.5]) {
      expect(() => actual.restore(invalid)).toThrow("Invalid PRNG state");
    }
  });
  it("retains the incremental UTF-16 seed hash", () => {
    for (const [prefix, suffix] of [
      ["match:", "Vitória"],
      ["⚽", "replay"],
      ["", "seed"],
    ]) {
      expect(hashSeed(suffix, hashSeed(prefix))).toBe(hashSeed(prefix + suffix));
    }
  });
});
