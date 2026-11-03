import { describe, expect, it } from "vitest";

import { STORE_PACKS } from "./store-catalog";

describe("store coin packs", () => {
  it("gives more coins per real as the coin pack gets bigger", () => {
    // The starter bundle is a one-time welcome offer, outside the regular ladder.
    const coinPacks = STORE_PACKS.filter((p) => p.kind === "coins" && p.key !== "starter_bundle").sort(
      (a, b) => a.priceCents - b.priceCents,
    );
    expect(coinPacks.map((p) => p.coins)).toEqual([250, 600, 2000, 4800]);
    for (let i = 1; i < coinPacks.length; i++) {
      const prev = coinPacks[i - 1]!;
      const cur = coinPacks[i]!;
      expect(cur.coins / cur.priceCents).toBeGreaterThan(prev.coins / prev.priceCents);
    }
  });

  it("charges the annual pass as 10 months of the monthly pass", () => {
    const monthly = STORE_PACKS.find((p) => p.key === "season_pass")!;
    const annual = STORE_PACKS.find((p) => p.key === "season_pass_annual")!;
    expect(annual.recurring).toBe("year");
    expect(annual.priceCents).toBe(monthly.priceCents * 10);
  });
});
