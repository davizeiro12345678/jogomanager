import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = "00000000-0000-4000-8000-000000000001";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown): unknown => value;
    const builder = {
      middleware: () => builder,
      validator(next: (value: unknown) => unknown) {
        validate = next;
        return builder;
      },
      handler(handle: (args: { data: unknown; context: { userId: string } }) => unknown) {
        return async (args: { data?: unknown } = {}) =>
          handle({ data: validate(args.data), context: { userId: USER } });
      },
    };
    return builder;
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

let functions: typeof import("./firebase-push.functions");

beforeEach(async () => {
  vi.resetModules();
  mocks.from.mockReset();
  functions = await import("./firebase-push.functions");
});

function lookupBuilder(result: { data: { user_id: string } | null; error: unknown }) {
  const filters: Array<[string, string]> = [];
  const terminal = {
    eq: vi.fn((column: string, value: string) => {
      filters.push([column, value]);
      return terminal;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return { builder: { select: vi.fn(() => terminal) }, filters };
}

function deleteBuilder(result: { error: unknown }) {
  const filters: Array<[string, string]> = [];
  const terminal = {
    eq: vi.fn((column: string, value: string) => {
      filters.push([column, value]);
      return filters.length === 2 ? Promise.resolve(result) : terminal;
    }),
  };
  return { builder: { delete: vi.fn(() => terminal) }, filters };
}

describe("authenticated FCM subscription lifecycle", () => {
  it("prevents account B from deleting account A by scoping deletion to auth context", async () => {
    const removal = deleteBuilder({ error: null });
    mocks.from.mockReturnValueOnce(removal.builder);
    await expect(
      functions.cleanupForeignPushSubscription({ data: { token: "opaque-token" } }),
    ).resolves.toEqual({ ok: true });
    expect(removal.filters).toEqual([
      ["user_id", USER],
      ["token", "opaque-token"],
    ]);

    await expect(
      functions.cleanupForeignPushSubscription({
        data: { token: "opaque-token", userId: "another-account" },
      }),
    ).rejects.toThrow();
  });
  it("fails closed when owner-scoped deletion fails", async () => {
    const removal = deleteBuilder({ error: new Error("unavailable") });
    mocks.from.mockReturnValueOnce(removal.builder);
    await expect(
      functions.cleanupForeignPushSubscription({ data: { token: "opaque-token" } }),
    ).resolves.toEqual({ ok: false });
    expect(removal.filters).toEqual([
      ["user_id", USER],
      ["token", "opaque-token"],
    ]);
  });
  it("reads legacy ownership with the authenticated owner filter", async () => {
    const lookup = lookupBuilder({ data: { user_id: USER }, error: null });
    mocks.from.mockReturnValueOnce(lookup.builder);
    await expect(
      functions.readOwnedPushSubscription({ data: { token: "opaque-token" } }),
    ).resolves.toEqual({ ok: true, owned: true });
    expect(lookup.filters).toEqual([
      ["user_id", USER],
      ["token", "opaque-token"],
    ]);
  });
  it("inserts only when the token is unowned and derives owner from auth context", async () => {
    const before = lookupBuilder({ data: null, error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const after = lookupBuilder({ data: { user_id: USER }, error: null });
    mocks.from
      .mockReturnValueOnce(before.builder)
      .mockReturnValueOnce({ upsert })
      .mockReturnValueOnce(after.builder);

    await expect(
      functions.upsertPushSubscriptionForCurrentUser({
        data: { token: "high-entropy-browser-token" },
      }),
    ).resolves.toEqual({ ok: true });

    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: USER,
        token: "high-entropy-browser-token",
        updated_at: expect.any(String),
      },
      { onConflict: "token", ignoreDuplicates: true },
    );
    expect(after.filters).toEqual([["token", "high-entropy-browser-token"]]);
  });

  it("rejects a token already owned by another account without writing", async () => {
    const lookup = lookupBuilder({ data: { user_id: "another-user" }, error: null });
    mocks.from.mockReturnValueOnce(lookup.builder);

    await expect(
      functions.upsertPushSubscriptionForCurrentUser({
        data: { token: "high-entropy-browser-token" },
      }),
    ).resolves.toEqual({ ok: false, reason: "token_owned_by_another_account" });
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite a foreign row that races the initial ownership lookup", async () => {
    const before = lookupBuilder({ data: null, error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const after = lookupBuilder({ data: { user_id: "another-user" }, error: null });
    mocks.from
      .mockReturnValueOnce(before.builder)
      .mockReturnValueOnce({ upsert })
      .mockReturnValueOnce(after.builder);

    await expect(
      functions.upsertPushSubscriptionForCurrentUser({
        data: { token: "high-entropy-browser-token" },
      }),
    ).resolves.toEqual({ ok: false, reason: "token_owned_by_another_account" });
    expect(upsert).toHaveBeenCalledWith(expect.any(Object), {
      onConflict: "token",
      ignoreDuplicates: true,
    });
  });

  it("rejects malformed tokens and any client-supplied owner before database access", async () => {
    await expect(
      functions.cleanupForeignPushSubscription({ data: { token: "contains whitespace" } }),
    ).rejects.toThrow();
    await expect(
      functions.upsertPushSubscriptionForCurrentUser({
        data: { token: "high-entropy-browser-token", userId: "attacker" },
      }),
    ).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
