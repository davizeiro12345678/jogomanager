import type { Stripe } from "@stripe/stripe-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@stripe/stripe-js/pure", () => ({ loadStripe: mock.load }));
beforeEach(() => {
  vi.resetModules();
  mock.load.mockReset();
  vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_fixture");
});
afterEach(() => vi.unstubAllEnvs());

describe("Stripe script retries", () => {
  it("retries after script rejection and shares a successful loader", async () => {
    const stripe = {} as Stripe;
    mock.load.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(stripe);
    const { getStripe } = await import("./stripe");
    await expect(getStripe()).rejects.toThrow("offline");
    expect(await getStripe()).toBe(stripe);
    expect(await getStripe()).toBe(stripe);
    expect(mock.load).toHaveBeenCalledTimes(2);
  });
  it("reports a null SDK result and allows a later retry", async () => {
    mock.load.mockResolvedValueOnce(null).mockResolvedValueOnce({});
    const { getStripe } = await import("./stripe");
    await expect(getStripe()).rejects.toThrow(/carregar/);
    await expect(getStripe()).resolves.toEqual({});
  });
  it("rejects missing public configuration before attempting to load Stripe", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "");
    const { getStripe } = await import("./stripe");
    expect(() => getStripe()).toThrow(/não configurados/);
    expect(mock.load).not.toHaveBeenCalled();
  });
});
