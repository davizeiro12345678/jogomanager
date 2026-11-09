import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ rpc: vi.fn(), deliver: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: dependencies.rpc },
}));
vi.mock("./email-automation.server", async (original) => ({
  ...(await original<typeof import("./email-automation.server")>()),
  deliverEmailAutomationEvent: dependencies.deliver,
}));
import { dispatchEmailAutomations } from "./email-automation-dispatch.server";

const lease = {
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
};
beforeEach(() => {
  dependencies.rpc.mockReset();
  dependencies.deliver.mockReset();
  vi.stubEnv("EMAIL_AUTOMATIONS_ENABLED", "true");
  vi.stubEnv("RESEND_API_KEY", "re_test_fixture");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("durable email dispatch", () => {
  it("remains inactive unless explicitly enabled and never reserves work without a provider key", async () => {
    vi.stubEnv("EMAIL_AUTOMATIONS_ENABLED", "false");
    expect((await dispatchEmailAutomations()).enabled).toBe(false);
    expect(dependencies.rpc).not.toHaveBeenCalled();
    vi.stubEnv("EMAIL_AUTOMATIONS_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(dispatchEmailAutomations()).rejects.toThrow("not configured");
    expect(dependencies.rpc).not.toHaveBeenCalled();
  });

  it("claims each confirmed database source once and returns aggregates without recipient data", async () => {
    vi.useFakeTimers();
    dependencies.rpc
      .mockResolvedValueOnce({ data: lease, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    dependencies.deliver.mockResolvedValue({
      outcome: "sent",
      httpStatus: 202,
      retryAfterSeconds: 0,
    });
    const dispatched = dispatchEmailAutomations();
    await vi.runAllTimersAsync();
    const result = await dispatched;
    expect(result).toMatchObject({ attempted: 1, accepted: 1, uncertain: 0 });
    expect(JSON.stringify(result)).not.toContain("example.test");
    expect(dependencies.rpc).toHaveBeenNthCalledWith(1, "claim_email_automation");
    expect(dependencies.rpc).toHaveBeenNthCalledWith(2, "complete_email_automation", {
      p_id: lease.id,
      p_lease_token: lease.lease_token,
      p_outcome: "sent",
      p_http_status: 202,
      p_retry_after_seconds: 0,
    });
  });

  it("stops on a provider rate limit or uncertain outcome without claiming the next event", async () => {
    for (const outcome of ["retry", "uncertain", "dead"] as const) {
      dependencies.rpc.mockReset();
      dependencies.rpc
        .mockResolvedValueOnce({ data: lease, error: null })
        .mockResolvedValueOnce({ data: true, error: null });
      dependencies.deliver.mockResolvedValue({
        outcome,
        httpStatus: outcome === "retry" ? 429 : 503,
        retryAfterSeconds: 60,
      });
      expect((await dispatchEmailAutomations()).attempted).toBe(1);
      expect(dependencies.rpc).toHaveBeenCalledTimes(2);
    }
  });

  it("does not retry acceptance when the acknowledgement is lost or the lease is stale", async () => {
    dependencies.rpc
      .mockResolvedValueOnce({ data: lease, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    dependencies.deliver.mockResolvedValue({
      outcome: "sent",
      httpStatus: 202,
      retryAfterSeconds: 0,
    });
    await expect(dispatchEmailAutomations()).rejects.toThrow("requires reconciliation");
    expect(dependencies.deliver).toHaveBeenCalledTimes(1);
    expect(dependencies.rpc).toHaveBeenCalledTimes(2);
  });

  it("caps a large queue at ten sequential provider requests per invocation", async () => {
    vi.useFakeTimers();
    dependencies.rpc.mockImplementation(async (name) => ({
      data: name === "claim_email_automation" ? lease : true,
      error: null,
    }));
    dependencies.deliver.mockResolvedValue({
      outcome: "sent",
      httpStatus: 202,
      retryAfterSeconds: 0,
    });
    const dispatched = dispatchEmailAutomations();
    await vi.runAllTimersAsync();
    expect(await dispatched).toMatchObject({ attempted: 10, accepted: 10 });
    expect(dependencies.deliver).toHaveBeenCalledTimes(10);
    expect(dependencies.rpc).toHaveBeenCalledTimes(20);
  });

  it("refuses malformed database leases before contacting the provider", async () => {
    dependencies.rpc.mockResolvedValueOnce({
      data: { ...lease, payload: { html: "forged" } },
      error: null,
    });
    await expect(dispatchEmailAutomations()).rejects.toThrow("Invalid email automation payload");
    expect(dependencies.deliver).not.toHaveBeenCalled();
  });
});
