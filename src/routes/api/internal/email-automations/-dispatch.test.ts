import { beforeEach, describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ authenticate: vi.fn(), dispatch: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/integrations/supabase/cron-auth", () => ({
  authenticateCronRequest: dependencies.authenticate,
}));
vi.mock("@/lib/email-automation-dispatch.server", () => ({
  dispatchEmailAutomations: dependencies.dispatch,
}));
import { Route } from "./dispatch";
const handle = (
  Route.options as unknown as {
    server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
beforeEach(() => {
  dependencies.authenticate.mockReset();
  dependencies.dispatch.mockReset();
});

describe("internal automation caller", () => {
  it("rejects unauthorized requests before loading or claiming dispatch work", async () => {
    dependencies.authenticate.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    const response = await handle({
      request: new Request("https://jogomanager.com/api/internal/email-automations/dispatch", {
        method: "POST",
      }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(dependencies.dispatch).not.toHaveBeenCalled();
  });

  it("does not forward request payloads into an event or recipient selector", async () => {
    dependencies.authenticate.mockResolvedValue(null);
    dependencies.dispatch.mockResolvedValue({ enabled: true, attempted: 0, accepted: 0 });
    const response = await handle({
      request: new Request("https://jogomanager.com/api/internal/email-automations/dispatch", {
        method: "POST",
        body: JSON.stringify({ email: "attacker@example.test", event: "purchase.fulfilled" }),
      }),
    });
    expect(response.status).toBe(200);
    expect(dependencies.dispatch).toHaveBeenCalledWith();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("attacker");
  });

  it("returns a bounded operational error without private provider details", async () => {
    dependencies.authenticate.mockResolvedValue(null);
    dependencies.dispatch.mockRejectedValue(new Error("secret provider response"));
    const response = await handle({
      request: new Request("https://jogomanager.com/api/internal/email-automations/dispatch", {
        method: "POST",
      }),
    });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret provider response");
  });
});
