import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "83c2f28e-d72e-43c0-9c52-70688f5f6a3e",
  verifiedAccount: vi.fn(),
  config: vi.fn(),
  enqueue: vi.fn(),
  admin: { rpc: vi.fn() },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("./verified-identity.server", () => ({ verifiedAccount: mocks.verifiedAccount }));
vi.mock("./support.server", () => ({
  supportWebhookConfig: mocks.config,
  enqueueSupportTicket: mocks.enqueue,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let parse = (input: unknown): unknown => input;
    const builder = {
      middleware: () => builder,
      validator: (next: (input: unknown) => unknown) => {
        parse = next;
        return builder;
      },
      handler:
        (
          handler: (args: {
            data: unknown;
            context: { userId: string; supabase: object };
          }) => unknown,
        ) =>
        async (args: { data: unknown }) =>
          handler({ data: parse(args.data), context: { userId: mocks.userId, supabase: {} } }),
    };
    return builder;
  },
}));
import { submitSupportTicket } from "./support.functions";
const send = submitSupportTicket as unknown as (args: { data: unknown }) => Promise<unknown>;
const input = {
  requestId: "8534946c-d202-4b0b-a2ce-f39b35c181e3",
  category: "gameplay",
  subject: "Partida travou",
  message: "A partida travou durante o segundo tempo.",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({
    url: "https://hooks.example.com/support",
    secret: "configured-secret",
  });
  mocks.verifiedAccount.mockResolvedValue({ id: mocks.userId, email: "verified@example.com" });
  mocks.enqueue.mockResolvedValue({ ok: true, ticketId: input.requestId, status: "queued" });
});

describe("support authenticated server function", () => {
  it("takes identity and email from the verified session only", async () => {
    expect(await send({ data: input })).toEqual({
      ok: true,
      ticketId: input.requestId,
      status: "queued",
    });
    expect(mocks.verifiedAccount).toHaveBeenCalledWith({}, mocks.userId);
    expect(mocks.enqueue).toHaveBeenCalledWith(
      mocks.admin,
      mocks.userId,
      "verified@example.com",
      input,
      expect.any(Object),
    );
  });
  it("requires verified email before persisting personal support data", async () => {
    mocks.verifiedAccount.mockResolvedValue(null);
    expect(await send({ data: input })).toEqual({ ok: false, reason: "verification_required" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it("does not pretend the automation is configured when the endpoint is unavailable", async () => {
    mocks.config.mockReturnValue(null);
    expect(await send({ data: input })).toEqual({ ok: false, reason: "unavailable" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it("rejects forged authority fields before auth or database work", async () => {
    await expect(
      send({ data: { ...input, email: "forged@example.com", delivered: true } }),
    ).rejects.toThrow();
    expect(mocks.verifiedAccount).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
