import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dispatchSupportOutbox,
  enqueueSupportTicket,
  signSupportPayload,
  supportWebhookConfig,
} from "./support.server";

const config = {
  url: "https://hooks.example.com/support",
  secret: "a-secret-with-at-least-thirty-two-characters",
};
const ticketId = "8534946c-d202-4b0b-a2ce-f39b35c181e3";
const job = {
  ticket_id: ticketId,
  user_id: "83c2f28e-d72e-43c0-9c52-70688f5f6a3e",
  email: "owner@example.com",
  category: "gameplay",
  subject: "Partida travou",
  message: "A partida travou durante o segundo tempo.",
  created_at: "2026-11-08T20:00:00.000Z",
  lease_token: "664ecf37-770e-41c1-9365-ae252ed7d8b1",
  attempts: 1,
};
const input = {
  requestId: ticketId,
  category: "gameplay" as const,
  subject: job.subject,
  message: job.message,
};
type Db = Parameters<typeof dispatchSupportOutbox>[0];
afterEach(() => vi.unstubAllGlobals());
function database(acknowledged = true) {
  const rpc = vi.fn(async (name: string) =>
    name === "claim_support_deliveries"
      ? { data: [job], error: null }
      : name === "create_support_ticket"
        ? { data: [{ ticket_id: ticketId, status: "queued" }], error: null }
        : { data: acknowledged, error: null },
  );
  return { db: { rpc } as unknown as Db, rpc };
}

describe("support webhook transport", () => {
  it("requires a secret and an HTTPS public DNS destination without credentials or unusual ports", () => {
    expect(
      supportWebhookConfig({
        SUPPORT_WEBHOOK_URL: config.url,
        SUPPORT_WEBHOOK_SECRET: config.secret,
      }),
    ).toEqual(config);
    for (const url of [
      "http://hooks.example.com",
      "https://localhost",
      "https://127.0.0.1",
      "https://10.0.0.5",
      "https://169.254.169.254",
      "https://[::1]",
      "https://user:password@hooks.example.com",
      "https://hooks.example.com:444",
      "https://service.internal",
      "https://service.local",
      "https://hooks.example.com/#fragment",
    ]) {
      expect(
        supportWebhookConfig({ SUPPORT_WEBHOOK_URL: url, SUPPORT_WEBHOOK_SECRET: config.secret }),
      ).toBeNull();
    }
    expect(
      supportWebhookConfig({ SUPPORT_WEBHOOK_URL: config.url, SUPPORT_WEBHOOK_SECRET: "short" }),
    ).toBeNull();
  });
  it("signs the exact timestamp and bytes, sends a stable ticket key and acknowledges only a 2xx", async () => {
    const { db, rpc } = database();
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await dispatchSupportOutbox(db, config, {
      maxJobs: 100,
      fetch: send,
      now: () => 1_800_000_000_000,
    });
    expect(result).toMatchObject({ claimed: 1, delivered: 1, retryQueued: 0 });
    const [url, options] = send.mock.calls[0]!;
    expect(url).toBe(config.url);
    expect(options).toMatchObject({ method: "POST", redirect: "error" });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    const body = String(options?.body);
    const headers = new Headers(options?.headers);
    expect(headers.get("idempotency-key")).toBe(`support-${ticketId}`);
    expect(headers.get("x-support-timestamp")).toBe("1800000000");
    const expected = createHmac("sha256", config.secret).update(`1800000000.${body}`).digest("hex");
    expect(headers.get("x-support-signature")).toBe(`sha256=${expected}`);
    expect(signSupportPayload(`${body}changed`, "1800000000", config.secret)).not.toBe(
      `sha256=${expected}`,
    );
    expect(rpc).toHaveBeenCalledWith("claim_support_deliveries", { p_limit: 3, p_ticket_id: null });
    expect(rpc).toHaveBeenLastCalledWith(
      "complete_support_delivery",
      expect.objectContaining({
        p_ticket_id: ticketId,
        p_lease_token: job.lease_token,
        p_delivered: true,
      }),
    );
  });
  it.each([503, 429, 408])("keeps HTTP %i queued for bounded retry", async (status) => {
    const { db, rpc } = database();
    const result = await dispatchSupportOutbox(db, config, {
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status })),
    });
    expect(result).toMatchObject({ delivered: 0, retryQueued: 1 });
    expect(rpc).toHaveBeenLastCalledWith(
      "complete_support_delivery",
      expect.objectContaining({
        p_delivered: false,
        p_retryable: true,
        p_error_code: `http_${status}`,
      }),
    );
  });
  it("does not follow redirects or mark permanent upstream rejection as delivered", async () => {
    const { db, rpc } = database();
    const result = await dispatchSupportOutbox(db, config, {
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(null, { status: 302, headers: { location: "http://127.0.0.1" } }),
        ),
    });
    expect(result).toMatchObject({ delivered: 0, failed: 1 });
    expect(rpc).toHaveBeenLastCalledWith(
      "complete_support_delivery",
      expect.objectContaining({ p_retryable: false, p_delivered: false }),
    );
  });
  it("retains ambiguous network failures and rejects a stale lease acknowledgement", async () => {
    const failed = database();
    const result = await dispatchSupportOutbox(failed.db, config, {
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error("timeout")),
    });
    expect(result).toMatchObject({ delivered: 0, retryQueued: 1 });
    const stale = database(false);
    const fenced = await dispatchSupportOutbox(stale.db, config, {
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
    });
    expect(fenced).toMatchObject({ delivered: 0, acknowledgementFailed: 1 });
  });
  it("returns queued when dispatch is unavailable after a durable insert", async () => {
    const rpc = vi.fn(async (name: string) =>
      name === "create_support_ticket"
        ? { data: [{ ticket_id: ticketId, status: "queued" }], error: null }
        : { data: null, error: { message: "unavailable" } },
    );
    const result = await enqueueSupportTicket(
      { rpc } as unknown as Db,
      job.user_id,
      job.email,
      input,
      config,
    );
    expect(result).toEqual({ ok: true, ticketId, status: "queued" });
  });
  it("preserves delivered idempotent retries without sending another webhook", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ ticket_id: ticketId, status: "delivered" }], error: null });
    expect(
      await enqueueSupportTicket({ rpc } as unknown as Db, job.user_id, job.email, input, config),
    ).toEqual({ ok: true, ticketId, status: "delivered" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("reports a definitive HTTP400 delivery failure with its existing ticket ID", async () => {
    const { db } = database();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 400 })),
    );
    expect(await enqueueSupportTicket(db, job.user_id, job.email, input, config)).toEqual({
      ok: true,
      ticketId,
      status: "delivery_failed",
    });
  });
  it("preserves a permanently failed idempotent retry without claiming or resending", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ ticket_id: ticketId, status: "delivery_failed" }],
      error: null,
    });
    expect(
      await enqueueSupportTicket({ rpc } as unknown as Db, job.user_id, job.email, input, config),
    ).toEqual({ ok: true, ticketId, status: "delivery_failed" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("maps quota and idempotency mismatch failures without disclosing database details", async () => {
    for (const message of ["support_rate_limited", "support_request_mismatch"]) {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { message } });
      expect(
        await enqueueSupportTicket({ rpc } as unknown as Db, job.user_id, job.email, input, config),
      ).toEqual({
        ok: false,
        reason: message === "support_rate_limited" ? "rate_limited" : "error",
      });
    }
  });
});
