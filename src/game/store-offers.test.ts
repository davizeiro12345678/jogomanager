import { describe, expect, it } from "vitest";
import { compareCoinOffers, salePrice } from "./store-offers";

const NOW = Date.parse("2026-10-20T12:00:00Z");
function offer(key: string, coins: number, price_cents: number, currency = "brl") {
  return { key, kind: "coins", coins, price_cents, currency };
}

describe("displayed store offer comparisons", () => {
  it("identifies the actual best rate and a dominated equal-price pack", () => {
    const values = compareCoinOffers(
      [
        offer("starter", 200, 490),
        offer("small", 500, 490),
        offer("medium", 1500, 1290),
        offer("large", 4000, 3990),
      ],
      NOW,
    );
    expect(values.get("starter")).toMatchObject({ isBestValue: false, betterOfferKey: "small" });
    expect(values.get("small")?.coinsPerUnit).toBeCloseTo(102.040816, 5);
    expect(values.get("medium")).toMatchObject({ isBestValue: true, betterOfferKey: null });
    expect(values.get("large")?.isBestValue).toBe(false);
  });

  it("compares each currency independently and keeps tied duplicate offers equal", () => {
    const values = compareCoinOffers(
      [offer("brl_a", 500, 490), offer("brl_b", 500, 490), offer("usd", 600, 100, "usd")],
      NOW,
    );
    expect(values.get("brl_a")).toMatchObject({ isBestValue: true, betterOfferKey: null });
    expect(values.get("brl_b")).toMatchObject({ isBestValue: true, betterOfferKey: null });
    expect(values.get("usd")).toMatchObject({ currency: "USD", coinsPerUnit: 600 });
  });

  it("uses the current rounded promotional amount and excludes non-comparable products", () => {
    const values = compareCoinOffers(
      [
        offer("normal", 500, 500),
        { ...offer("sale", 400, 600), sale_percent_off: 50 },
        { ...offer("pass", 99999, 1), kind: "pass" },
        offer("free", 500, 0),
        offer("invalid", Number.NaN, 100),
      ],
      NOW,
    );
    expect(values.get("sale")).toMatchObject({ cents: 300, isBestValue: true });
    expect([...values.keys()]).toEqual(["normal", "sale"]);
  });

  it.each([
    { sale_percent_off: 100 },
    { sale_percent_off: 10.5 },
    { sale_percent_off: 50, sale_starts_at: "invalid" },
    { sale_percent_off: 50, sale_ends_at: "invalid" },
    { sale_percent_off: 50, sale_starts_at: "2026-10-21", sale_ends_at: "2026-10-19" },
    { sale_percent_off: 50, sale_starts_at: "2026-10-21" },
    { sale_percent_off: 50, sale_ends_at: "2026-10-19" },
  ])("does not advertise invalid or inactive promotions: %j", (sale) => {
    expect(salePrice({ price_cents: 490, ...sale }, NOW)).toEqual({ cents: 490, percent: 0 });
  });
});
