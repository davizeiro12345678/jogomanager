import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { checkMatchAuxReadiness } from "./match-aux-readiness.server";

const env = {
  MATCH_AUX_URL: "https://aux.example.test",
  MATCH_AUX_SIGNING_KEY: "test-signing-key-with-at-least-32-characters",
};

describe("auxiliary match readiness adapter", () => {
  it("signs the exact readiness body and bounds a non-cacheable HTTPS request", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true, busy: false }));
    expect(await checkMatchAuxReadiness(env, fetcher)).toBe(true);
    const [url, request] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://aux.example.test/v1/readiness");
    expect(request).toMatchObject({
      method: "POST",
      body: '{"probe":"readiness"}',
      cache: "no-store",
      redirect: "error",
    });
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.headers["x-pfm-signature"]).toBe(
      createHmac("sha256", env.MATCH_AUX_SIGNING_KEY)
        .update(`${request.headers["x-pfm-timestamp"]}.${request.body}`)
        .digest("hex"),
    );
    expect(JSON.stringify(request)).not.toContain(env.MATCH_AUX_SIGNING_KEY);
  });

  it("keeps a busy but healthy simulation service ready", async () => {
    expect(
      await checkMatchAuxReadiness(
        env,
        vi.fn().mockResolvedValue(Response.json({ ok: true, busy: true })),
      ),
    ).toBe(true);
  });

  it.each([
    {},
    { ...env, MATCH_AUX_SIGNING_KEY: "short" },
    { ...env, MATCH_AUX_URL: "not-a-url" },
    { ...env, MATCH_AUX_URL: "http://aux.example.test" },
    { ...env, MATCH_AUX_URL: "https://user:password@aux.example.test" },
  ])("rejects missing or unsafe configuration before network access: %j", async (config) => {
    const fetcher = vi.fn();
    expect(await checkMatchAuxReadiness(config, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([{ ok: false, busy: false }, { ok: true }, { ok: true, busy: "false" }, null, []])(
    "rejects malformed or unhealthy replies: %j",
    async (reply) => {
      expect(
        await checkMatchAuxReadiness(env, vi.fn().mockResolvedValue(Response.json(reply))),
      ).toBe(false);
    },
  );

  it("rejects HTTP errors, invalid JSON and transport failures without provider details", async () => {
    for (const response of [
      Response.json({ ok: true, busy: false }, { status: 503 }),
      new Response("<html>provider error</html>"),
      Response.redirect("https://other.example.test", 307),
    ]) {
      expect(await checkMatchAuxReadiness(env, vi.fn().mockResolvedValue(response))).toBe(false);
    }
    expect(
      await checkMatchAuxReadiness(env, vi.fn().mockRejectedValue(new Error("private detail"))),
    ).toBe(false);
  });
});
