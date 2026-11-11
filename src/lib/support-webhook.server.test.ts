import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupportRequestInput } from "./support-input";
import {
  dispatchSupportRequest,
  readSupportConfiguration,
  signSupportWebhook,
  supportPayloadHash,
  type SupportStore,
} from "./support-webhook.server";

const user = { id: "00000000-0000-4000-8000-000000000001", email: "support-test@example.invalid" };
const input = {
  requestId: "00000000-0000-4000-8000-000000000002",
  category: "bug" as const,
  message: "O botão de salvar não responde na tela de táticas.",
  website: "",
};
const payload = { email: user.email, category: input.category, message: input.message };
const leaseToken = "00000000-0000-4000-8000-000000000003";
const configuration = { url: "https://support.example.invalid/webhook", secret: "x".repeat(64) };
function makeStore() {
  return {
    reserve: vi.fn<SupportStore["reserve"]>().mockResolvedValue({
      status: "leased",
      leaseToken,
      createdAt: "2026-11-08T22:00:00+00:00",
      payload,
    }),
    finish: vi.fn<SupportStore["finish"]>().mockResolvedValue(true),
  };
}
afterEach(() => vi.unstubAllEnvs());

describe("support submission boundary", () => {
  it("validates lengths, visible text, request ids and unknown identity fields", () => {
    expect(SupportRequestInput.parse({ ...input, message: `  ${input.message}  ` }).message).toBe(
      input.message,
    );
    for (const value of [
      { ...input, userId: user.id },
      { ...input, email: user.email },
      { ...input, requestId: "invalid" },
      { ...input, message: "short" },
      { ...input, message: "x".repeat(4001) },
      { ...input, category: "https://attacker.invalid" },
    ]) {
      expect(SupportRequestInput.safeParse(value).success).toBe(false);
    }
  });
  it("keeps disabled or invalid configuration closed without a database or network call", async () => {
    const store = makeStore();
    const fetcher = vi.fn<typeof fetch>();
    expect(
      await dispatchSupportRequest(input, user, store, { configuration: null, fetch: fetcher }),
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(
      await dispatchSupportRequest({ ...input, website: "robot" }, user, store, {
        configuration,
        fetch: fetcher,
      }),
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(store.reserve).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("pins HTTPS to server configuration and refuses credentials, fragments or short secrets", () => {
    vi.stubEnv("SUPPORT_WEBHOOK_ENABLED", "true");
    vi.stubEnv("SUPPORT_WEBHOOK_SECRET", configuration.secret);
    vi.stubEnv("SUPABASE_URL", "https://database.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "not-a-real-secret");
    for (const value of [
      "http://example.invalid",
      "https://user:pass@example.invalid",
      "https://example.invalid/#secret",
      "invalid",
    ]) {
      vi.stubEnv("SUPPORT_WEBHOOK_URL", value);
      expect(readSupportConfiguration()).toBeNull();
    }
    vi.stubEnv("SUPPORT_WEBHOOK_URL", configuration.url);
    expect(readSupportConfiguration()).toEqual(configuration);
    vi.stubEnv("SUPPORT_WEBHOOK_SECRET", "short");
    expect(readSupportConfiguration()).toBeNull();
  });
  it("signs the exact raw body with timestamp and stable event id", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const store = makeStore();
    expect(
      await dispatchSupportRequest(input, user, store, {
        configuration,
        fetch: fetcher,
        now: () => 1794175200000,
      }),
    ).toEqual({ ok: true, requestId: input.requestId });
    expect(store.reserve).toHaveBeenCalledWith(
      user.id,
      input.requestId,
      await supportPayloadHash(JSON.stringify(payload)),
      payload,
    );
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe(configuration.url);
    expect(request?.redirect).toBe("error");
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    const headers = new Headers(request?.headers);
    const eventId = `support:${user.id}:${input.requestId}`;
    expect(headers.get("Idempotency-Key")).toBe(eventId);
    expect(headers.get("X-JogoManager-Timestamp")).toBe("1794175200");
    const expected = createHmac("sha256", configuration.secret)
      .update(`1794175200.${eventId}.${String(request?.body)}`)
      .digest("hex");
    expect(headers.get("X-JogoManager-Signature")).toBe(`v1=${expected}`);
    expect(JSON.parse(String(request?.body))).toEqual({
      type: "support.requested",
      version: 1,
      id: eventId,
      userId: user.id,
      createdAt: "2026-11-08T22:00:00+00:00",
      ...payload,
    });
    expect(store.finish).toHaveBeenCalledWith(user.id, input.requestId, leaseToken, true);
  });
  it("does not resend delivered, leased, conflicting, over-quota or exhausted requests", async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const status of ["sent", "pending", "conflict", "rate_limited", "unavailable"] as const) {
      const store = makeStore();
      store.reserve.mockResolvedValue({ status });
      const result = await dispatchSupportRequest(input, user, store, {
        configuration,
        fetch: fetcher,
      });
      expect(result).toEqual(
        status === "sent"
          ? { ok: true, requestId: input.requestId }
          : { ok: false, reason: status },
      );
      expect(store.finish).not.toHaveBeenCalled();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("records ambiguous failures without claiming delivery and reuses the same external id", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("secret endpoint error"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = makeStore();
    expect(
      await dispatchSupportRequest(input, user, store, { configuration, fetch: fetcher }),
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(store.finish).toHaveBeenNthCalledWith(1, user.id, input.requestId, leaseToken, false);
    expect(
      await dispatchSupportRequest(input, user, store, { configuration, fetch: fetcher }),
    ).toEqual({ ok: true, requestId: input.requestId });
    const requests = fetcher.mock.calls.map(([, request]) =>
      new Headers(request?.headers).get("Idempotency-Key"),
    );
    expect(new Set(requests).size).toBe(1);
  });
  it("never claims delivery when final state cannot be recorded or upstream returns an error", async () => {
    const store = makeStore();
    store.finish.mockResolvedValue(false);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    expect(
      await dispatchSupportRequest(input, user, store, { configuration, fetch: fetcher }),
    ).toEqual({ ok: false, reason: "unavailable" });
    store.finish.mockResolvedValue(true);
    fetcher.mockResolvedValue(new Response(null, { status: 503 }));
    expect(
      await dispatchSupportRequest(input, user, store, { configuration, fetch: fetcher }),
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(store.finish).toHaveBeenLastCalledWith(user.id, input.requestId, leaseToken, false);
  });
  it("binds the signature to body, id and timestamp independently", async () => {
    const original = await signSupportWebhook(configuration.secret, "1", "id", "body");
    expect(await signSupportWebhook(configuration.secret, "2", "id", "body")).not.toBe(original);
    expect(await signSupportWebhook(configuration.secret, "1", "another", "body")).not.toBe(
      original,
    );
    expect(await signSupportWebhook(configuration.secret, "1", "id", "tampered")).not.toBe(
      original,
    );
  });
});
