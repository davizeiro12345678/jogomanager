import { describe, expect, it } from "vitest";

import { classifyGuestCheckoutSession } from "./guest-checkout-state";

describe("guest checkout session state", () => {
  it("keeps a completed asynchronous payment in settlement", () => {
    expect(classifyGuestCheckoutSession("complete", "unpaid")).toBe("settling");
  });

  it("separates open, paid and closed Stripe sessions", () => {
    expect(classifyGuestCheckoutSession("open", "unpaid")).toBe("open");
    expect(classifyGuestCheckoutSession("complete", "paid")).toBe("paid");
    expect(classifyGuestCheckoutSession("complete", "no_payment_required")).toBe("paid");
    expect(classifyGuestCheckoutSession("expired", "unpaid")).toBe("closed");
    expect(classifyGuestCheckoutSession(undefined, undefined)).toBe("closed");
  });
});
