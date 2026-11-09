import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  configuration: null as { url: string; secret: string } | null,
  verified: vi.fn(),
  dispatch: vi.fn(),
  store: vi.fn(),
  middlewares: [] as unknown[],
  actor: "00000000-0000-4000-8000-000000000001",
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: "verified-auth-middleware",
}));
vi.mock("./verified-identity.server", () => ({ verifiedAccount: mocks.verified }));
vi.mock("./support-store.server", () => ({ createSupportStore: mocks.store }));
vi.mock("./support-webhook.server", () => ({
  readSupportConfiguration: () => mocks.configuration,
  dispatchSupportRequest: mocks.dispatch,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown): unknown => value;
    const builder = {
      middleware: (value: unknown) => {
        mocks.middlewares.push(value);
        return builder;
      },
      validator: (value: (input: unknown) => unknown) => {
        validate = value;
        return builder;
      },
      handler: (handle: (args: unknown) => unknown) => (args?: { data: unknown }) =>
        handle({
          data: validate(args?.data),
          context: { userId: mocks.actor, supabase: "scoped-client" },
        }),
    };
    return builder;
  },
}));
import { getSupportAvailability, submitSupportRequest } from "./support.functions";
const data = {
  requestId: "00000000-0000-4000-8000-000000000002",
  category: "bug" as const,
  message: "Synthetic report with enough detail to reproduce.",
  website: "",
};
beforeEach(() => {
  mocks.configuration = { url: "https://support.example.invalid", secret: "secret-only-on-server" };
  mocks.verified
    .mockReset()
    .mockResolvedValue({ id: mocks.actor, email: "verified@example.invalid" });
  mocks.store.mockReset().mockResolvedValue("private-store");
  mocks.dispatch.mockReset().mockResolvedValue({ ok: true, requestId: data.requestId });
});
describe("authenticated support function", () => {
  it("requires the auth middleware and reveals only a public availability flag", async () => {
    expect(mocks.middlewares).toContainEqual(["verified-auth-middleware"]);
    expect(await getSupportAvailability()).toEqual({ enabled: true });
    mocks.configuration = null;
    expect(await getSupportAvailability()).toEqual({ enabled: false });
  });
  it("derives actor and verified email from the server, rejecting client identity fields", async () => {
    expect(await submitSupportRequest({ data })).toEqual({ ok: true, requestId: data.requestId });
    expect(mocks.verified).toHaveBeenCalledWith("scoped-client", mocks.actor);
    expect(mocks.dispatch).toHaveBeenCalledWith(
      data,
      { id: mocks.actor, email: "verified@example.invalid" },
      "private-store",
      { configuration: mocks.configuration },
    );
    expect(() =>
      submitSupportRequest({ data: { ...data, email: "spoof@example.invalid" } as typeof data }),
    ).toThrow();
  });
  it("does not dispatch for unverified accounts, disabled support or honeypots", async () => {
    mocks.verified.mockResolvedValue(null);
    expect(await submitSupportRequest({ data })).toEqual({
      ok: false,
      reason: "verification_required",
    });
    mocks.configuration = null;
    expect(await submitSupportRequest({ data })).toEqual({ ok: false, reason: "unavailable" });
    mocks.configuration = {
      url: "https://support.example.invalid",
      secret: "secret-only-on-server",
    };
    expect(await submitSupportRequest({ data: { ...data, website: "spam" } })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
  });
  it("does not expose auth lookup or persistence failures", async () => {
    mocks.verified.mockRejectedValueOnce(new Error("private provider detail"));
    expect(await submitSupportRequest({ data })).toEqual({ ok: false, reason: "unavailable" });
    mocks.store.mockRejectedValueOnce(new Error("private database detail"));
    expect(await submitSupportRequest({ data })).toEqual({ ok: false, reason: "unavailable" });
  });
});
