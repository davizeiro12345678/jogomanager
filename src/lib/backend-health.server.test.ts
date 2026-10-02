import { describe, expect, it, vi } from "vitest";
import { checkBackendHealth } from "./backend-health.server";

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
    const fetcher = vi.fn().mockResolvedValue(Response.json({ external: { email: true } }));
    expect((await checkBackendHealth(env, fetcher)).status).toBe("ready");
    expect(
      (await checkBackendHealth({ ...env, SUPABASE_SERVICE_ROLE_KEY: "" }, fetcher)).status,
    ).toBe("degraded");
    const request = fetcher.mock.calls[0]![1];
    expect(request.headers.apikey).toBe(env.SUPABASE_PUBLISHABLE_KEY);
    expect(JSON.stringify(request)).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
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
