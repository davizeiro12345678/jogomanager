import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ rpc: vi.fn(), runImport: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: fixture.rpc } }));
vi.mock("@/lib/apifootball-import.server", () => ({ runApiFootballImport: fixture.runImport }));
import { Route } from "./sync-football";
const post = (
  Route as unknown as {
    server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
const request = () =>
  new Request("https://app.example.test/api/public/sync-football?scope=apifootball-managed", {
    method: "POST",
    headers: { "x-sync-secret": "qa-synthetic-cron-secret" },
  });
const lease = {
  out_phase: "teams",
  out_offset: 0,
  out_limit: 10,
  out_token: "qa-synthetic-lease-token",
};
beforeEach(() => {
  vi.stubEnv("FOOTBALL_SYNC_SECRET", "qa-synthetic-cron-secret");
  fixture.rpc.mockReset();
  fixture.runImport.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("managed import completion SQL contract", () => {
  it("sends SQL NULL for a completed phase and an absent error", async () => {
    fixture.rpc
      .mockResolvedValueOnce({ data: [lease], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    fixture.runImport.mockResolvedValue({
      ok: true,
      phase: "teams",
      processed: 10,
      nextOffset: null,
    });
    expect((await post({ request: request() })).status).toBe(200);
    expect(fixture.rpc).toHaveBeenLastCalledWith("complete_api_football_import_phase", {
      p_phase: "teams",
      p_token: lease.out_token,
      p_processed: 10,
      p_next_offset: null,
      p_error: null,
    });
  });

  it("preserves retry offset and provider error when a phase has not completed", async () => {
    fixture.rpc
      .mockResolvedValueOnce({ data: [lease], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    fixture.runImport.mockResolvedValue({
      ok: false,
      phase: "teams",
      processed: 0,
      nextOffset: 0,
      error: "minute_quota_exhausted",
    });
    expect((await post({ request: request() })).status).toBe(503);
    expect(fixture.rpc).toHaveBeenLastCalledWith("complete_api_football_import_phase", {
      p_phase: "teams",
      p_token: lease.out_token,
      p_processed: 0,
      p_next_offset: 0,
      p_error: "minute_quota_exhausted",
    });
  });

  it("rejects malformed leases before running or acknowledging import work", async () => {
    fixture.rpc.mockResolvedValueOnce({ data: [{ ...lease, out_offset: -1 }], error: null });
    expect((await post({ request: request() })).status).toBe(409);
    expect(fixture.runImport).not.toHaveBeenCalled();
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
  });
});
