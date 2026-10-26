import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = vi.hoisted(() => ({ sports: vi.fn(), ssr: vi.fn() }));
vi.mock("./lib/sportsdb-source.server", () => ({ handleSportsDbSourceRequest: handlers.sports }));
vi.mock("@tanstack/react-start/server-entry", () => ({ default: { fetch: handlers.ssr } }));
import server from "./server";

describe("private sports source dispatch at the outer server boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.sports.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    handlers.ssr.mockResolvedValue(
      new Response("SSR", { headers: { "content-type": "text/html" } }),
    );
  });

  it("keeps authorization failures private and replaces a supplied nonce before the source handler", async () => {
    const env = { SPORTS_DB: { test: true } };
    const request = new Request("https://example.test/api/public/sportsdb", {
      headers: { authorization: "Bearer local-test", "x-manager-csp-nonce": "attacker-controlled" },
    });
    const response = await server.fetch(request, env, {});
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(handlers.ssr).not.toHaveBeenCalled();
    const [forwarded, receivedEnv] = handlers.sports.mock.calls[0]!;
    expect(receivedEnv).toBe(env);
    expect(forwarded.headers.get("authorization")).toBe("Bearer local-test");
    expect(forwarded.headers.get("x-manager-csp-nonce")).not.toBe("attacker-controlled");
    expect(forwarded.headers.get("x-manager-csp-nonce")).toMatch(/^[A-Za-z0-9+/]{32}$/);
  });

  it("does not widen the privileged route to arbitrary path suffixes", async () => {
    const response = await server.fetch(
      new Request("https://example.test/api/public/sportsdb/extra"),
      {},
      {},
    );
    expect(await response.text()).toBe("SSR");
    expect(handlers.sports).not.toHaveBeenCalled();
    expect(handlers.ssr).toHaveBeenCalledOnce();
  });

  it("applies the ordinary response protections to an authorized source response", async () => {
    handlers.sports.mockResolvedValue(
      new Response('{"ok":true}', {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      }),
    );
    const response = await server.fetch(
      new Request("https://example.test/api/public/sportsdb"),
      {},
      {},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=63072000");
    expect(await response.json()).toEqual({ ok: true });
  });
});
