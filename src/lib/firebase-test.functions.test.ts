import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { from, select, eq, maybeSingle, deliver } = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  deliver: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: vi.fn() }));
vi.mock("./firebase-delivery.server", () => ({ sendFirebaseTestPush: deliver }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      validator: (validate: (data: unknown) => unknown) => ({
        handler:
          (handle: (args: { data: unknown; context: unknown }) => unknown) =>
          async (args: { data: unknown; context: unknown }) =>
            handle({ ...args, data: validate(args.data) }),
      }),
    }),
  }),
}));
import { sendTestPush } from "./firebase-test.functions";

const send = sendTestPush as unknown as (args: {
  data: { token: string };
  context: { supabase: { from: typeof from }; userId: string };
}) => Promise<{ ok: boolean; reason?: string }>;
const request = {
  data: { token: "device-token" },
  context: { supabase: { from }, userId: "user-a" },
};
const fetcher = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("FIREBASE_PROJECT_ID", "sscxz-2ee8d");
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", "private credentials");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
  vi.stubGlobal("fetch", fetcher);
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ eq, maybeSingle });
  maybeSingle.mockResolvedValue({ data: { id: "subscription" }, error: null });
  fetcher.mockResolvedValue(new Response("true", { status: 200 }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("push test authorization and limits", () => {
  it("restricts lookup to the authenticated user and requested device before reserving the limit and sending", async () => {
    expect(await send(request)).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("push_subscriptions");
    expect(eq).toHaveBeenNthCalledWith(1, "user_id", "user-a");
    expect(eq).toHaveBeenNthCalledWith(2, "token", "device-token");
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/reserve_firebase_push_test",
      expect.objectContaining({ body: JSON.stringify({ p_user_id: "user-a" }) }),
    );
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({ deviceToken: "device-token", projectId: "sscxz-2ee8d" }),
    );
  });
  it("never sends to a device not owned by the user", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await send(request)).toEqual({ ok: false, reason: "not_registered" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });
  it("fails closed when the rate limit is exhausted or unavailable", async () => {
    fetcher.mockResolvedValueOnce(new Response("false", { status: 200 }));
    expect(await send(request)).toEqual({ ok: false, reason: "rate_limited" });
    fetcher.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect(await send(request)).toEqual({ ok: false, reason: "unavailable" });
    expect(deliver).not.toHaveBeenCalled();
  });
  it("fails closed without server credentials", async () => {
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", "");
    expect(await send(request)).toEqual({ ok: false, reason: "unavailable" });
    expect(from).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });
});
