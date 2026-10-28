import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
import { classifyChatText, reviewChatBeforePublish } from "./context-moderation.server";

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("contextual moderation provider", () => {
  it("sends the message and bounded previous context only to the fixed moderation endpoint", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ results: [{ flagged: false }] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(classifyChatText("test-secret", "Boa jogada", ["Tudo bem?"])).resolves.toBe(
      "allow",
    );
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/moderations");
    const payload = JSON.parse(request.body as string);
    expect(payload.model).toBe("omni-moderation-latest");
    expect(payload.input).toContain("Tudo bem?");
    expect(payload.input).toContain("Boa jogada");
  });

  it("blocks flagged content", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ results: [{ flagged: true }] }), { status: 200 }),
        ),
    );
    await expect(classifyChatText("test-secret", "mensagem", [])).resolves.toBe("block");
  });

  it.each([
    new Response("{}", { status: 200 }),
    new Response("upstream failure", { status: 503 }),
    new Response("x".repeat(20_000), { status: 200 }),
  ])("fails closed on malformed, unavailable or oversized provider responses", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(classifyChatText("test-secret", "mensagem", [])).resolves.toBe("unavailable");
  });

  it("fails closed when the provider call throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret should not escape")));
    await expect(classifyChatText("test-secret", "mensagem", [])).resolves.toBe("unavailable");
  });
});

describe("moderation admission", () => {
  it("does not call the provider when the feature is disabled", async () => {
    vi.stubEnv("OPENAI_CHAT_MODERATION_ENABLED", "false");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(reviewChatBeforePublish("user", "Oi")).resolves.toBe("allow");
    expect(rpc).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed without a configured key", async () => {
    vi.stubEnv("OPENAI_CHAT_MODERATION_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(reviewChatBeforePublish("user", "Oi")).resolves.toBe("unavailable");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("checks membership and rate limit before the provider call", async () => {
    vi.stubEnv("OPENAI_CHAT_MODERATION_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-secret");
    rpc.mockResolvedValue({ data: null, error: { message: "rate_limited" } });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(reviewChatBeforePublish("user", "Oi", "room")).resolves.toBe("rate_limited");
    expect(rpc).toHaveBeenCalledWith("reserve_chat_moderation_for", {
      _user_id: "user",
      _room_id: "room",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
