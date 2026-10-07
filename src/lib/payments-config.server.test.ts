import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertGuestCheckoutEnabled, readCheckoutAvailability } from "./payments-config.server";

beforeEach(() => {
  vi.stubEnv("PAYMENTS_ENVIRONMENT", "live");
  vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_live_fixture");
  vi.stubEnv("STRIPE_LIVE_API_KEY", "sk_live_fixture");
  vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture_service_role");
  vi.stubEnv("PAYMENTS_LIVE_WEBHOOK_SECRET", "whsec_fixture");
  vi.stubEnv("GUEST_CHECKOUT_ENVIRONMENT", "live");
  vi.stubEnv("GUEST_CHECKOUT_LIVE_ENABLED", "true");
  vi.stubEnv("GUEST_CHECKOUT_EMAIL_HASH_SECRET", "fixture_hash_secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("payment availability before checkout", () => {
  it("allows account and guest checkout only with the required server configuration", () => {
    expect(readCheckoutAvailability()).toEqual({
      environment: "live",
      account: { enabled: true, message: null },
      guest: { enabled: true, message: null },
    });
  });
  it.each(["STRIPE_LIVE_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "PAYMENTS_LIVE_WEBHOOK_SECRET"])(
    "blocks charges that cannot be created or delivered when %s is missing",
    (name) => {
      vi.stubEnv(name, "");
      const result = readCheckoutAvailability();
      expect(result.account.enabled).toBe(false);
      expect(result.guest.enabled).toBe(false);
      expect(JSON.stringify(result)).not.toContain(name);
    },
  );
  it("rejects a secret key from a different Stripe environment", () => {
    vi.stubEnv("STRIPE_LIVE_API_KEY", "sk_test_fixture");
    expect(readCheckoutAvailability().account.enabled).toBe(false);
  });
  it("keeps account checkout available when the guest rollout is disabled", () => {
    vi.stubEnv("GUEST_CHECKOUT_LIVE_ENABLED", "false");
    const result = readCheckoutAvailability();
    expect(result.account.enabled).toBe(true);
    expect(result.guest.enabled).toBe(false);
  });
  it("does not open guest checkout with a missing email hash secret or a different environment", () => {
    vi.stubEnv("GUEST_CHECKOUT_EMAIL_HASH_SECRET", "");
    expect(() => assertGuestCheckoutEnabled()).toThrow(/segurança/);
    vi.stubEnv("GUEST_CHECKOUT_EMAIL_HASH_SECRET", "fixture_hash_secret");
    vi.stubEnv("GUEST_CHECKOUT_ENVIRONMENT", "sandbox");
    vi.stubEnv("DEV", false);
    expect(() => assertGuestCheckoutEnabled()).toThrow(/corresponder/);
  });
});
