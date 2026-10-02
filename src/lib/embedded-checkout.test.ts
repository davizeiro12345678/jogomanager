import type { StripeEmbeddedCheckoutOptions } from "@stripe/stripe-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startEmbeddedCheckout, withPaymentTimeout } from "./embedded-checkout";

const cleanups: Array<() => void> = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers();
});

function fixture() {
  const element = {} as HTMLElement;
  const instance = { mount: vi.fn(), unmount: vi.fn(), destroy: vi.fn() };
  const create = vi
    .fn<(options: StripeEmbeddedCheckoutOptions) => Promise<typeof instance>>()
    .mockResolvedValue(instance);
  const load = vi.fn().mockResolvedValue({ createEmbeddedCheckoutPage: create });
  const fetchSecret = vi.fn().mockResolvedValue("cs_test_fixture_secret_fixture");
  const phase = vi.fn();
  const error = vi.fn();
  const start = () => {
    const cleanup = startEmbeddedCheckout({
      element,
      loadStripe: load,
      fetchClientSecret: fetchSecret,
      onPhase: phase,
      onError: error,
      timeoutMs: 100,
    });
    cleanups.push(cleanup);
    return cleanup;
  };
  return { element, instance, create, load, fetchSecret, phase, error, start };
}

describe("embedded payment lifecycle", () => {
  it("bounds a stalled server response without leaving the screen busy forever", async () => {
    const request = withPaymentTimeout(new Promise<string>(() => undefined), 100);
    const assertion = expect(request).rejects.toThrow(/demorou/);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
  it("reports a rejected Stripe script and does not create a payment session", async () => {
    const f = fixture();
    f.load.mockRejectedValue(new Error("Falha ao carregar Stripe.js"));
    f.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.error).toHaveBeenCalledWith("Falha ao carregar Stripe.js");
    expect(f.fetchSecret).not.toHaveBeenCalled();
  });

  it("surfaces initialization rejection immediately instead of leaving an empty checkout", async () => {
    const f = fixture();
    f.create.mockRejectedValue(new Error("A sessão de pagamento expirou"));
    f.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.error).toHaveBeenCalledWith("A sessão de pagamento expirou");
    expect(f.instance.mount).not.toHaveBeenCalled();
  });

  it("keeps the loading state until Stripe reports its rendered form", async () => {
    const f = fixture();
    const stop = f.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.instance.mount).toHaveBeenCalledWith(f.element);
    expect(f.phase).not.toHaveBeenCalledWith("ready");
    const options = f.create.mock.calls[0]![0];
    expect(await options.fetchClientSecret!()).toBe("cs_test_fixture_secret_fixture");
    options.onAnalyticsEvent!({
      eventType: "checkoutRendered",
      checkoutSession: "cs_test_fixture",
      details: {},
      clientMetadata: {},
      timestamp: 0,
    });
    expect(f.phase).toHaveBeenLastCalledWith("ready");
    await vi.advanceTimersByTimeAsync(200);
    expect(f.error).not.toHaveBeenCalled();
    stop();
    expect(f.instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys a late SDK result after the player closes the checkout", async () => {
    const f = fixture();
    let resolve!: (instance: typeof f.instance) => void;
    f.create.mockReturnValue(
      new Promise((complete) => {
        resolve = complete;
      }),
    );
    const stop = f.start();
    await vi.advanceTimersByTimeAsync(0);
    stop();
    resolve(f.instance);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.instance.destroy).toHaveBeenCalledTimes(1);
    expect(f.instance.mount).not.toHaveBeenCalled();
    expect(f.error).not.toHaveBeenCalled();
  });

  it("bounds loading and safely disposes an initialization that completes after timeout", async () => {
    const f = fixture();
    let resolve!: (instance: typeof f.instance) => void;
    f.create.mockReturnValue(
      new Promise((complete) => {
        resolve = complete;
      }),
    );
    f.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(f.error).toHaveBeenCalledWith(expect.stringContaining("demorou"));
    resolve(f.instance);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.instance.destroy).toHaveBeenCalledTimes(1);
    expect(f.instance.mount).not.toHaveBeenCalled();
    expect(f.error).toHaveBeenCalledTimes(1);
  });

  it("asks the player to sign in when the server rejects the account session", async () => {
    const f = fixture();
    f.fetchSecret.mockRejectedValue(new Error("Unauthorized: Invalid token"));
    f.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.error).toHaveBeenCalledWith(expect.stringContaining("Entre novamente"));
    expect(f.create).not.toHaveBeenCalled();
  });
});
