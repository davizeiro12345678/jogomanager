import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  config: vi.fn(),
  dispatch: vi.fn(),
  admin: {},
}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (value: unknown) => value }));
vi.mock("@/integrations/supabase/cron-auth", () => ({
  authenticateCronRequest: mocks.authenticate,
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("@/lib/support.server", () => ({
  supportWebhookConfig: mocks.config,
  dispatchSupportOutbox: mocks.dispatch,
}));
import { Route } from "./support-dispatch";
const handle = (
  Route as unknown as {
    server: { handlers: { POST(args: { request: Request }): Promise<Response> } };
  }
).server.handlers.POST;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticate.mockResolvedValue(null);
  mocks.config.mockReturnValue({ url: "https://hooks.example.com", secret: "configured" });
  mocks.dispatch.mockResolvedValue({
    claimed: 1,
    delivered: 1,
    retryQueued: 0,
    failed: 0,
    acknowledgementFailed: 0,
  });
});
describe("support dispatch cron boundary", () => {
  it("rejects an unauthenticated caller before looking up personal jobs", async () => {
    mocks.authenticate.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    const result = await handle({
      request: new Request("https://game.example.com/api/internal/support-dispatch", {
        method: "POST",
      }),
    });
    expect(result.status).toBe(401);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("returns aggregate counts only, with no-store, after authenticated dispatch", async () => {
    const result = await handle({
      request: new Request("https://game.example.com/api/internal/support-dispatch", {
        method: "POST",
      }),
    });
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toEqual({
      ok: true,
      claimed: 1,
      delivered: 1,
      retryQueued: 0,
      failed: 0,
      acknowledgementFailed: 0,
    });
  });
  it("reports missing webhook configuration as unavailable without claiming jobs", async () => {
    mocks.config.mockReturnValue(null);
    expect(
      (
        await handle({
          request: new Request("https://game.example.com/api/internal/support-dispatch", {
            method: "POST",
          }),
        })
      ).status,
    ).toBe(503);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
