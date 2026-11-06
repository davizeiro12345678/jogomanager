import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  userId: "00000000-0000-4000-8000-000000000001",
  message: { user_id: "00000000-0000-4000-8000-000000000002" } as { user_id: string } | null,
  insertError: null as { code: string; message: string } | null,
  insert: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input: unknown): unknown => input;
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: mocks.message, error: null }),
      insert: async (data: unknown) => {
        mocks.insert(data);
        return { error: mocks.insertError };
      },
    };
    const builder = {
      middleware: () => builder,
      validator: (next: (input: unknown) => unknown) => {
        validate = next;
        return builder;
      },
      handler: (handle: (args: unknown) => unknown) => (args: { data: unknown }) =>
        handle({
          data: validate(args.data),
          context: { userId: mocks.userId, supabase: { from: () => query } },
        }),
    };
    return builder;
  },
}));
import { reportChatMessage } from "./community.functions";
const data = { messageId: "00000000-0000-4000-8000-000000000003", reason: "Ofensa no chat" };
beforeEach(() => {
  mocks.message = { user_id: "00000000-0000-4000-8000-000000000002" };
  mocks.insertError = null;
  mocks.insert.mockClear();
});
describe("chat reporting", () => {
  it("records the authenticated reporter, not a supplied identity", async () => {
    expect(await reportChatMessage({ data })).toEqual({ ok: true });
    expect(mocks.insert).toHaveBeenCalledWith({
      message_id: data.messageId,
      reporter_id: mocks.userId,
      reason: data.reason,
    });
  });
  it("rejects reports of the reporter's own message", async () => {
    mocks.message = { user_id: mocks.userId };
    expect(await reportChatMessage({ data })).toEqual({ ok: false, reason: "error" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects missing or inaccessible messages", async () => {
    mocks.message = null;
    expect(await reportChatMessage({ data })).toEqual({ ok: false, reason: "error" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("treats a duplicate as success without masking other errors", async () => {
    mocks.insertError = { code: "23505", message: "duplicate" };
    expect(await reportChatMessage({ data })).toEqual({ ok: true });
    mocks.insertError = { code: "23514", message: "report_rate_limited" };
    expect(await reportChatMessage({ data })).toEqual({ ok: false, reason: "error" });
  });
  it("enforces ten reports per hour at the database boundary with serialized writes", () => {
    const sql = readFileSync(
      new URL("../../drizzle/migrations/0049_limit_chat_report_abuse.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("interval '1 hour') >= 10");
    expect(sql).toContain("NEW.created_at := now()");
    expect(sql).toContain("target_user = NEW.reporter_id");
  });
});
