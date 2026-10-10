import { describe, expect, it } from "vitest";

import {
  isSubscriptionActive,
  selectEffectiveSubscription,
  type SubscriptionRow,
} from "./useSubscription";

const now = new Date("2026-10-09T12:00:00.000Z");
const row = (id: string, status: string, current_period_end: string | null): SubscriptionRow => ({
  id,
  status,
  current_period_end,
  cancel_at_period_end: false,
  price_id: "price_fixture",
});

describe("effective subscription selection", () => {
  it("keeps the furthest valid entitlement when an older cancellation arrives", () => {
    const chosen = selectEffectiveSubscription(
      [
        row("old", "canceled", "2026-10-10T12:00:00.000Z"),
        row("new", "active", "2026-11-10T12:00:00.000Z"),
      ],
      now,
    );
    expect(chosen?.id).toBe("new");
  });

  it("does not expose expired or terminal subscriptions as valid", () => {
    expect(isSubscriptionActive(row("expired", "active", "2026-10-08T12:00:00.000Z"), now)).toBe(
      false,
    );
    expect(isSubscriptionActive(row("ended", "unpaid", "2026-11-10T12:00:00.000Z"), now)).toBe(
      false,
    );
    expect(
      selectEffectiveSubscription([row("ended", "unpaid", "2026-11-10T12:00:00.000Z")], now),
    ).toBeNull();
  });
});
