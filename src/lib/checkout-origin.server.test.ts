import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTrustedCheckoutOrigin, validateCheckoutReturnUrl } from "./checkout-origin.server";

beforeEach(() => vi.stubEnv("SITE_URL", "https://jogomanager.com"));
afterEach(() => vi.unstubAllEnvs());
const request = (headers: HeadersInit = {}) =>
  new Request("https://jogomanager.com/_server", { headers });

describe("checkout return boundary", () => {
  it.each([
    "https://evil.example/checkout/return",
    "https://jogomanager.com.evil.example/checkout/return",
    "https://jogomanager.com@evil.example/checkout/return",
    "https://evil.example@jogomanager.com/checkout/return",
    "javascript:alert(1)",
    "https://jogomanager.com\\@evil.example/checkout/return",
    "https://jogomanager.com/checkout/return#https://evil.example",
    " https://jogomanager.com/checkout/return",
    "https://jogomanager.com/checkout/return\n",
  ])("rejects ambiguous or external returns: %s", (value) => {
    expect(() => validateCheckoutReturnUrl(request(), value, "/checkout/return")).toThrow();
    expect(() => validateCheckoutReturnUrl(request(), value)).toThrow();
  });
  it("keeps the official return and literal Stripe session placeholder", () => {
    const value = "https://JOGOMANAGER.com:443/checkout/return?session_id={CHECKOUT_SESSION_ID}";
    expect(validateCheckoutReturnUrl(request(), value, "/checkout/return")).toBe(
      "https://jogomanager.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(validateCheckoutReturnUrl(request(), "https://jogomanager.com/produtos")).toBe(
      "https://jogomanager.com/produtos",
    );
  });
  it("rejects a checkout path other than the dedicated return", () => {
    expect(() =>
      validateCheckoutReturnUrl(request(), "https://jogomanager.com/produtos", "/checkout/return"),
    ).toThrow();
  });
  it.each([
    { origin: "https://evil.example" },
    { origin: "null" },
    { "sec-fetch-site": "cross-site" },
  ])("rejects cross-site calls before payment work", (headers) => {
    expect(() => getTrustedCheckoutOrigin(request(headers))).toThrow(/origem/);
  });
  it("does not derive the configured origin from a forged host or forwarded headers", () => {
    expect(() =>
      getTrustedCheckoutOrigin(
        new Request("https://evil.example/_server", {
          headers: { "x-forwarded-host": "jogomanager.com" },
        }),
      ),
    ).toThrow(/origem/);
  });
  it("keeps localhost ports available in development only", () => {
    const local = new Request("http://localhost:4181/_server", {
      headers: { origin: "http://localhost:4181" },
    });
    vi.stubEnv("DEV", true);
    expect(getTrustedCheckoutOrigin(local)).toBe("http://localhost:4181");
    vi.stubEnv("DEV", false);
    expect(() => getTrustedCheckoutOrigin(local)).toThrow(/origem/);
  });
});
