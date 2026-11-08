import { afterEach, describe, expect, it, vi } from "vitest";

import { isDeadToken, MAX_TOKENS_PER_EVENT, sendPushToTokens } from "./push.server";

afterEach(() => {
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
