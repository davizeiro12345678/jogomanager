import { describe, expect, it } from "vitest";
import { starterSessionAction } from "./starter-checkout.server";

const owner = {
  session_id: "cs_qa",
  user_id: "user_qa",
  environment: "sandbox",
  price_cents: 690,
  currency: "BRL",
};
const session = {
  id: "cs_qa",
  livemode: false,
  mode: "payment",
  status: "open",
  payment_status: "unpaid",
  metadata: { userId: "user_qa", productKey: "starter_bundle" },
  amount_subtotal: 690,
  currency: "brl",
  client_secret: "cs_qa_secret_fixture",
};

describe("starter checkout slot recovery", () => {
  it("reuses only the owner's open unpaid embedded checkout", () => {
    expect(starterSessionAction(owner, session)).toBe("reuse");
  });
  it("releases only a Stripe-confirmed expired unpaid checkout", () => {
    expect(
      starterSessionAction(owner, { ...session, status: "expired", client_secret: null }),
    ).toBe("release");
  });
  it.each([
    { status: "complete" },
    { payment_status: "paid" },
    { status: "expired", payment_status: "paid" },
    { livemode: true },
    { mode: "subscription" },
    { metadata: { userId: "other", productKey: "starter_bundle" } },
    { metadata: { userId: "user_qa", productKey: "coins_small" } },
    { id: "cs_other" },
    { amount_subtotal: 691 },
    { currency: "usd" },
    { client_secret: null },
  ])("rejects a conflicting, settled or unusable Stripe session (%j)", (patch) => {
    expect(() => starterSessionAction(owner, { ...session, ...patch })).toThrow();
  });
});
