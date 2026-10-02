import { describe, expect, it } from "vitest";

import { isSeasonPassDelivered } from "./subscription-delivery.server";

function fixture() {
  return {
    userId: "user_a",
    subscriptionId: "sub_fixture",
    environment: "live",
    now: Date.parse("2026-10-02T00:00:00Z"),
    subscription: {
      user_id: "user_a",
      stripe_subscription_id: "sub_fixture",
      environment: "live",
      status: "active",
      current_period_end: "2026-11-02T00:00:00Z",
    },
    wallet: { season_pass: true, season_pass_until: "2026-11-02T00:00:00Z" },
  };
}
describe("attested season pass delivery", () => {
  it("recognizes the active pass without relying on a one-time purchase row", () => {
    expect(isSeasonPassDelivered(fixture())).toBe(true);
  });
  it("waits until the signed webhook has updated both subscription and wallet", () => {
    expect(isSeasonPassDelivered({ ...fixture(), wallet: null })).toBe(false);
    expect(isSeasonPassDelivered({ ...fixture(), subscription: null })).toBe(false);
    expect(
      isSeasonPassDelivered({
        ...fixture(),
        wallet: { season_pass: false, season_pass_until: null },
      }),
    ).toBe(false);
  });
  it.each(["userId", "subscriptionId", "environment"] as const)(
    "rejects a different %s",
    (field) => {
      expect(isSeasonPassDelivered({ ...fixture(), [field]: "other" })).toBe(false);
    },
  );
  it("does not report an expired or unpaid subscription as delivered", () => {
    const f = fixture();
    expect(
      isSeasonPassDelivered({ ...f, subscription: { ...f.subscription, status: "incomplete" } }),
    ).toBe(false);
    expect(isSeasonPassDelivered({ ...f, now: Date.parse("2026-12-02T00:00:00Z") })).toBe(false);
  });
});
