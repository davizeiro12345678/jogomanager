import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isDeadToken,
  MAX_PARALLEL_PUSH_REQUESTS,
  MAX_TOKENS_PER_EVENT,
  sendPushToTokens,
  sendPushToUsers,
} from "./push.server";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env["LOVABLE_API_KEY"];
  delete process.env["FIREBASE_MESSAGING_API_KEY"];
});

describe("isDeadToken", () => {
  it("marks explicitly unregistered tokens as dead", () => {
    expect(isDeadToken(404, "UNREGISTERED")).toBe(true);
  });
  it("keeps tokens when a gateway route or message payload is invalid", () => {
    expect(isDeadToken(404, "Not Found")).toBe(false);
    expect(isDeadToken(400, "INVALID_ARGUMENT")).toBe(false);
  });
  it("removes a token on a structured Firebase registration error", () => {
    const body = JSON.stringify({
      error: {
        message: "The registration token is not a valid FCM registration token",
        details: [
          {
            "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
            errorCode: "INVALID_ARGUMENT",
          },
        ],
      },
    });
    expect(isDeadToken(400, body)).toBe(true);
  });
  it("keeps other 400 errors", () => {
    expect(isDeadToken(400, "BAD_REQUEST")).toBe(false);
  });
  it("keeps 429 and 500", () => {
    expect(isDeadToken(429, "")).toBe(false);
    expect(isDeadToken(500, "")).toBe(false);
  });
});

describe("sendPushToTokens", () => {
  it("does nothing without gateway keys", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await sendPushToTokens(["t1"], { title: "a", body: "b" });
    expect(result).toEqual({ sent: 0, deadTokens: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends one message per token and collects dead tokens", async () => {
    process.env["LOVABLE_API_KEY"] = "k1";
    process.env["FIREBASE_MESSAGING_API_KEY"] = "k2";
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("UNREGISTERED", { status: 404 }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await sendPushToTokens(["t1", "t2", "t3"], {
      title: "Sala dos técnicos",
      body: "nova mensagem",
      path: "/chat",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ sent: 1, deadTokens: ["t2"] });
  });

  it("bounds concurrent gateway requests while sending to every selected device", async () => {
    process.env["LOVABLE_API_KEY"] = "k1";
    process.env["FIREBASE_MESSAGING_API_KEY"] = "k2";
    let active = 0;
    let maxActive = 0;
    const pending: Array<() => void> = [];
    const fetchSpy = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          pending.push(() => {
            active -= 1;
            resolve(new Response("{}", { status: 200 }));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const sending = sendPushToTokens(
      Array.from({ length: 12 }, (_, i) => `device-${i}`),
      { title: "Partida", body: "Começou" },
    );
    await vi.waitFor(() => expect(pending.length).toBe(MAX_PARALLEL_PUSH_REQUESTS));
    expect(maxActive).toBe(MAX_PARALLEL_PUSH_REQUESTS);

    for (let i = 0; i < 12; i += 1) {
      await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
      pending.shift()!();
    }
    expect(await sending).toEqual({ sent: 12, deadTokens: [] });
    expect(fetchSpy).toHaveBeenCalledTimes(12);
    expect(maxActive).toBeLessThanOrEqual(MAX_PARALLEL_PUSH_REQUESTS);
    expect(active).toBe(0);
  });

  it("isolates an offline gateway request without losing later notifications", async () => {
    process.env["LOVABLE_API_KEY"] = "k1";
    process.env["FIREBASE_MESSAGING_API_KEY"] = "k2";
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    expect(await sendPushToTokens(["device-a", "device-b"], { title: "a", body: "b" })).toEqual({
      sent: 1,
      deadTokens: [],
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.mock.calls)).not.toContain("device-a");
  });

  it("never contacts more tokens than the per-event cap", async () => {
    process.env["LOVABLE_API_KEY"] = "k1";
    process.env["FIREBASE_MESSAGING_API_KEY"] = "k2";
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const tokens = Array.from({ length: MAX_TOKENS_PER_EVENT + 50 }, (_, i) => `t${i}`);
    await sendPushToTokens(tokens, { title: "a", body: "b" });
    expect(fetchSpy).toHaveBeenCalledTimes(MAX_TOKENS_PER_EVENT);
  });
});

it("limits dead-token cleanup to the original subscription version", async () => {
  process.env["LOVABLE_API_KEY"] = "k1";
  process.env["FIREBASE_MESSAGING_API_KEY"] = "k2";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("UNREGISTERED", { status: 404 })));
  const row = { id: "old-id", token: "t1", user_id: "owner", updated_at: "2026-11-10T00:00:00Z" };
  const filters: Record<string, string> = {};
  const deletion = {
    eq(field: string, value: string) {
      filters[field] = value;
      return this;
    },
  };
  const admin = {
    from: () => ({
      select: () => ({ in: () => ({ limit: async () => ({ data: [row], error: null }) }) }),
      delete: () => deletion,
    }),
  } as unknown as Parameters<typeof sendPushToUsers>[0];
  await sendPushToUsers(admin, ["owner"], { title: "a", body: "b" });
  expect(filters).toEqual(row);
});
