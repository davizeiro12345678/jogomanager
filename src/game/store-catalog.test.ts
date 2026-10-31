import { describe, expect, it } from "vitest";

import { STORE_PACKS } from "./store-catalog";

describe("store coin packs", () => {
  it("gives more coins per real as the coin pack gets bigger", () => {
    const coinPacks = STORE_PACKS.filter((p) => p.kind === "coins").sort(
      (a, b) => a.priceCents - b.priceCents,
    );
    expect(coinPacks.map((p) => p.coins)).toEqual([250, 600, 2000, 4800]);
    for (let i = 1; i < coinPacks.length; i++) {
      const prev = coinPacks[i - 1]!;
      const cur = coinPacks[i]!;
      expect(cur.coins / cur.priceCents).toBeGreaterThan(prev.coins / prev.priceCents);
    }
  });
});
