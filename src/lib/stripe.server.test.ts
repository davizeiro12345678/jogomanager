import { afterEach, describe, expect, it, vi } from "vitest";

import { createStripeClient, resolveConfiguredStripeEnvironment } from "./stripe.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("portable Stripe transport", () => {
  it("uses Stripe directly with a native key and without a Lovable credential", async () => {
    vi.stubEnv("STRIPE_SANDBOX_API_KEY", "sk_test_fixture");
    vi.stubEnv("LOVABLE_API_KEY", "");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ object: "balance", available: [], pending: [], livemode: false }),
      );
    vi.stubGlobal("fetch", fetcher);
    await createStripeClient("sandbox").balance.retrieve();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain("https://api.stripe.com/v1/balance");
    expect(JSON.stringify(init)).not.toContain("Lovable-API-Key");
  });
  it("fails closed when a live secret is configured as sandbox", () => {
    vi.stubEnv("STRIPE_SANDBOX_API_KEY", "sk_live_fixture");
    expect(() => createStripeClient("sandbox")).toThrow(/ambiente/);
  });
});

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
