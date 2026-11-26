import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deliverEmailAutomationEvent,
  EMAIL_AUTOMATION_EVENTS,
  parseEmailAutomationLease,
} from "./email-automation.server";

const fixture = () => ({
  id: "66000000-0000-4000-8000-000000000001",
  lease_token: "66000000-0000-4000-8000-000000000002",
  user_id: "66000000-0000-4000-8000-000000000003",
  source_id: "66000000-0000-4000-8000-000000000004",
  event_name: "purchase.fulfilled",
  recipient_email: "confirmed@example.test",
  payload: {
    user_id: "66000000-0000-4000-8000-000000000003",
    order_id: "66000000-0000-4000-8000-000000000004",
  },
  attempts: 1,
});

afterEach(() => vi.unstubAllGlobals());

describe("server-derived email automation contract", () => {
  it("validates source identity and matches all five existing provider workflow aliases", () => {
    expect(Object.keys(EMAIL_AUTOMATION_EVENTS)).toHaveLength(5);
    const lease = parseEmailAutomationLease(fixture());
    expect(lease.event).toBe("purchase.fulfilled");
    expect(lease.payload["order_id"]).toBe(lease.sourceId);
  });

  it("rejects free-form payloads, another user's identity, prototype names and unbounded attempts", () => {
    const raw = fixture();
    for (const modified of [
      { ...raw, payload: { ...raw.payload, html: "attacker controlled" } },
      { ...raw, payload: { ...raw.payload, user_id: raw.source_id } },
      { ...raw, payload: { ...raw.payload, order_id: raw.user_id } },
      { ...raw, event_name: "toString" },
      { ...raw, event_name: "unregistered.event" },
      { ...raw, attempts: 7 },
      { ...raw, attempts: 0 },
      { ...raw, recipient_email: "victim@example.test\r\nBcc:another@example.test" },
      { ...raw, recipient_email: " confirmed@example.test " },
      { ...raw, lease_token: "missing-token" },
    ]) {
      expect(() => parseEmailAutomationLease(modified)).toThrow(/Invalid|valid email/);
    }
  });

  it("accepts only the fixed locale for onboarding and confirmed signup events", () => {
    const raw = fixture();
    const signup = {
      ...raw,
      source_id: raw.user_id,
      event_name: "user.created",
      payload: { user_id: raw.user_id, locale: "pt-BR" },
    };
    expect(parseEmailAutomationLease(signup).payload).toEqual(signup.payload);
    expect(() =>
      parseEmailAutomationLease({ ...signup, payload: { ...signup.payload, locale: "<script>" } }),
    ).toThrow("Invalid email automation payload");
  });
});

describe("Resend automation transport", () => {
  const request = vi.fn<typeof fetch>();
  beforeEach(() => {
    request.mockReset();
    vi.stubGlobal("fetch", request);
  });

  it("uses only the official HTTPS event endpoint with fixed payload and a stable source key", async () => {
    request.mockResolvedValue(new Response(null, { status: 202 }));
    const lease = parseEmailAutomationLease(fixture());
    expect(await deliverEmailAutomationEvent(lease, "re_test_fixture")).toEqual({
      outcome: "sent",
      httpStatus: 202,
      retryAfterSeconds: 0,
    });
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/events/send");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init?.headers).get("idempotency-key")).toBe(`jgm-automation/${lease.id}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      event: "purchase.fulfilled",
      email: "confirmed@example.test",
      payload: lease.payload,
    });
  });

  it("queues retry only for explicit rate limiting and honors a bounded Retry-After", async () => {
    request.mockResolvedValue(
      new Response(null, { status: 429, headers: { "retry-after": "300" } }),
    );
    const lease = parseEmailAutomationLease(fixture());
    expect(await deliverEmailAutomationEvent(lease, "re_test_fixture")).toEqual({
      outcome: "retry",
      httpStatus: 429,
      retryAfterSeconds: 300,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("quarantines timeouts, 5xx and unexpected 2xx instead of firing another automation", async () => {
    const lease = parseEmailAutomationLease(fixture());
    request.mockRejectedValueOnce(new DOMException("network timeout", "TimeoutError"));
    expect((await deliverEmailAutomationEvent(lease, "re_test_fixture")).outcome).toBe("uncertain");
    for (const status of [500, 502, 503, 504, 200, 201, 204, 302]) {
      request.mockResolvedValueOnce(new Response(null, { status }));
      expect((await deliverEmailAutomationEvent(lease, "re_test_fixture")).outcome).toBe(
        "uncertain",
      );
    }
    expect(request).toHaveBeenCalledTimes(9);
  });

  it("does not retry invalid configuration or permanent provider rejection", async () => {
    const lease = parseEmailAutomationLease(fixture());
    await expect(deliverEmailAutomationEvent(lease, "bad\r\nkey")).rejects.toThrow("configuration");
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(new Response("private provider body", { status: 401 }));
    const result = await deliverEmailAutomationEvent(lease, "re_test_fixture");
    expect(result).toEqual({ outcome: "dead", httpStatus: 401, retryAfterSeconds: 0 });
    expect(JSON.stringify(result)).not.toContain("private provider body");
  });
});
