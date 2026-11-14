import { describe, expect, it, vi } from "vitest";
import { checkBackendHealth, selectBackendHealthEnvironment } from "./backend-health.server";

const env = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "private-test-key",
};
describe("backend readiness", () => {
  it("is degraded without configuration and does not make requests", async () => {
    const fetcher = vi.fn();
    expect((await checkBackendHealth({}, fetcher)).status).toBe("degraded");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires both reachable auth and server credentials", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ external: { email: true } }))
      .mockResolvedValueOnce(Response.json({ users: [] }))
      .mockResolvedValueOnce(Response.json([{ id: "competition" }]))
      .mockResolvedValueOnce(Response.json({ external: { email: true } }));
    expect((await checkBackendHealth(env, fetcher)).status).toBe("ready");
    expect(
      (await checkBackendHealth({ ...env, SUPABASE_SERVICE_ROLE_KEY: "" }, fetcher)).status,
    ).toBe("degraded");
    const request = fetcher.mock.calls[0]![1];
    expect(request.headers.apikey).toBe(env.SUPABASE_PUBLISHABLE_KEY);
    expect(JSON.stringify(request)).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
  });
  it("rejects a wrong private key even when public authentication is available", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ external: { email: true } }))
      .mockResolvedValueOnce(Response.json({ message: "Invalid API key" }, { status: 401 }));
    const result = await checkBackendHealth(env, fetcher);
    expect(result.status).toBe("degraded");
    expect(result.checks).toEqual({ auth: true, serverCredentials: false, database: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("requires the migrated database and does not disclose admin account data", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ external: { email: true } }))
      .mockResolvedValueOnce(Response.json({ users: [{ email: "private@example.test" }] }))
      .mockResolvedValueOnce(Response.json({ message: "missing table" }, { status: 404 }));
    const result = await checkBackendHealth(env, fetcher);
    expect(result.status).toBe("degraded");
    expect(result.checks.serverCredentials).toBe(true);
    expect(result.checks.database).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/private|email|missing table/);
    expect(fetcher.mock.calls[1]![1].headers).toEqual({ apikey: env.SUPABASE_SERVICE_ROLE_KEY });
  });
  it("supports legacy service-role JWTs in the server probe", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ external: { email: true } }))
      .mockResolvedValueOnce(Response.json({ users: [] }))
      .mockResolvedValueOnce(Response.json([]));
    const legacyKey = "eyJlegacy-service-role";
    expect(
      (await checkBackendHealth({ ...env, SUPABASE_SERVICE_ROLE_KEY: legacyKey }, fetcher)).status,
    ).toBe("ready");
    expect(fetcher.mock.calls[1]![1].headers.Authorization).toBe(`Bearer ${legacyKey}`);
  });
  it("does not treat an HTML error page as healthy", async () => {
    expect(
      (await checkBackendHealth(env, vi.fn().mockResolvedValue(new Response("<html>error</html>"))))
        .status,
    ).toBe("degraded");
  });
  it("does not return private values when the upstream fails", async () => {
    const result = await checkBackendHealth(env, vi.fn().mockRejectedValue(new Error("secret")));
    expect(result.checks.auth).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-test-key");
  });
});

describe("backend health runtime environment", () => {
  it("reads native Worker bindings when process.env lacks the backend keys", () => {
    const selected = selectBackendHealthEnvironment({}, {
      SUPABASE_URL: "https://isolated.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-from-binding",
      SUPABASE_SERVICE_ROLE_KEY: "server-secret-from-binding",
      UNRELATED_PRIVATE_SECRET: "must-not-be-imported",
    });
    expect(selected).toEqual({
      SUPABASE_URL: "https://isolated.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-from-binding",
      SUPABASE_SERVICE_ROLE_KEY: "server-secret-from-binding",
    });
  });

  it("preserves the Node preview fallback for absent or invalid bindings", () => {
    const nodeEnvironment = {
      SUPABASE_URL: "https://node-preview.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "node-public",
      SUPABASE_SERVICE_ROLE_KEY: "node-secret",
    };
    expect(selectBackendHealthEnvironment(nodeEnvironment)).toBe(nodeEnvironment);
    expect(
      selectBackendHealthEnvironment(nodeEnvironment, {
        SUPABASE_URL: "",
        SUPABASE_PUBLISHABLE_KEY: null,
        SUPABASE_SERVICE_ROLE_KEY: 42,
      }),
    ).toEqual(nodeEnvironment);
  });

  it("prefers Worker over stale Node process.env only for explicit health keys", () => {
    const selected = selectBackendHealthEnvironment(
      { SUPABASE_URL: "https://wrong.supabase.co", OTHER: "unmodified" },
      { SUPABASE_URL: "https://correct.supabase.co", OTHER: "do-not-overwrite" },
    );
    expect(selected.SUPABASE_URL).toBe("https://correct.supabase.co");
    expect(selected.OTHER).toBe("unmodified");
  });
});
