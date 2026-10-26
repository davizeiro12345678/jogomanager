import { describe, expect, it } from "vitest";
import { makeRng, sumRngDraws } from "./rng";

describe("deterministic RNG compatibility", () => {
  it.each([
    [
      "bench-rng",
      [
        3856634139, 3898844741, 164481552, 2708625591, 2800942373, 3550318670, 1394110468,
        4261613448,
      ],
    ],
    [
      0,
      [
        1359758873, 3760313662, 2319906781, 3272789475, 3481105972, 1455627209, 2197685140,
        320403602,
      ],
    ],
    [
      4294967295,
      [253983, 4228382207, 1958451267, 4056713434, 2049502865, 2560970988, 1705115568, 279806459],
    ],
  ] as const)("retains the recorded unsigned stream for %s", (seed, expected) => {
    const rnd = makeRng(seed);
    expect(expected.map(() => rnd() * 4294967296)).toEqual(expected);
    expect(rnd.state()).toBe(expected[expected.length - 1]);
    rnd.restore(expected[2]);
    expect(rnd() * 4294967296).toBe(expected[3]);
  });

  it("sums independent short streams without changing draw order or precision", () => {
    for (const seed of [0, 1, 0xffffffff, "", "match-day:🌈:home", "bench-rng"]) {
      for (const count of [0, 1, 2, 3, 17, 1000]) {
        const rnd = makeRng(seed);
        let expected = 0;
        for (let index = 0; index < count; index++) expected += rnd();
        expect(sumRngDraws(seed, count)).toBe(expected);
      }
    }
  });
});
