import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyWebhook } from "./stripe.server";
afterEach(() => vi.unstubAllEnvs());
const fixtureSecret = "whsec_test_fixture_only";
function signedRequest(body: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", fixtureSecret);
  const digest = createHmac("sha256", fixtureSecret).update(`${timestamp}.${body}`).digest("hex");
  return new Request("https://jogomanager.com/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": `t=${timestamp},v1=${digest}` },
  });
}
function event(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "evt_fixture",
    object: "event",
    type: "charge.refunded",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: { id: "ch_fixture" } },
    ...overrides,
  });
}
describe("verified Stripe envelope", () => {
  it("verifies the raw signed bytes and a bounded snapshot envelope", async () => {
    const payload = event();
    expect(await verifyWebhook(signedRequest(payload), "sandbox")).toEqual(JSON.parse(payload));
  });
  it("rejects nonnumeric timestamps, stale signatures and body tampering", async () => {
    await expect(verifyWebhook(signedRequest(event(), "NaN"), "sandbox")).rejects.toThrow(
      /signature format/,
    );
    await expect(
      verifyWebhook(signedRequest(event(), String(Math.floor(Date.now() / 1000) - 301)), "sandbox"),
    ).rejects.toThrow(/too old/);
    const original = signedRequest(event());
    const altered = new Request(original.url, {
      method: "POST",
      headers: original.headers,
      body: event({ type: "invoice.paid" }),
    });
    await expect(verifyWebhook(altered, "sandbox")).rejects.toThrow(/signature/);
  });
  it("rejects an environment mismatch even with a valid signature", async () => {
    await expect(
      verifyWebhook(signedRequest(event({ livemode: true })), "sandbox"),
    ).rejects.toThrow(/environment/);
  });
  it("bounds chunked bodies independently of Content-Length", async () => {
    await expect(verifyWebhook(signedRequest("x".repeat(1_048_577)), "sandbox")).rejects.toThrow(
      /too large/,
    );
  });
});
