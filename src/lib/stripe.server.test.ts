import { describe, expect, it } from "vitest";

import { resolveConfiguredStripeEnvironment } from "./stripe.server";

describe("configured Stripe environment", () => {
  it("uses an explicit server environment when it agrees with the deployed public key", () => {
    expect(
      resolveConfiguredStripeEnvironment({
        deploymentEnvironment: "live",
        clientToken: "pk_live_example",
      }),
    ).toBe("live");
  });

  it("uses the server-side public key only as a legacy fallback", () => {
    expect(resolveConfiguredStripeEnvironment({ clientToken: "pk_test_example" })).toBe("sandbox");
  });

  it("fails closed for a browser/server environment mismatch", () => {
    expect(() =>
      resolveConfiguredStripeEnvironment({
        deploymentEnvironment: "live",
        clientToken: "pk_test_example",
      }),
    ).toThrow(/não corresponde/);
  });

  it("rejects unknown deployment environments and client tokens", () => {
    expect(() => resolveConfiguredStripeEnvironment({ deploymentEnvironment: "preview" })).toThrow(
      /sandbox ou live/,
    );
    expect(() =>
      resolveConfiguredStripeEnvironment({ clientToken: "not-a-stripe-public-key" }),
    ).toThrow(/chave pública Stripe/);
  });
});
