import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      validator: (validate: (input: unknown) => unknown) => ({
        handler:
          (handle: (args: { data: unknown; context: unknown }) => unknown) =>
          async (args: { data: unknown; context: unknown }) =>
            handle({ ...args, data: validate(args.data) }),
      }),
    }),
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));

import { sendChatMessage } from "./chat.functions";

const send = sendChatMessage as unknown as (args: {
  data: { body: string };
  context: { userId: string };
}) => Promise<unknown>;

beforeEach(() => vi.clearAllMocks());

describe("server chat boundary", () => {
  it("rejects an obfuscated abusive message before touching the database", async () => {
    await expect(send({ data: { body: "p.o.r.r.a" }, context: { userId: "u1" } })).resolves.toEqual(
      {
        ok: false,
        reason: "blocked",
      },
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends allowed text under the authenticated user identity", async () => {
    rpc.mockResolvedValue({ data: "message-id", error: null });
    await expect(
      send({ data: { body: "Boa partida!" }, context: { userId: "u1" } }),
    ).resolves.toEqual({
      ok: true,
      id: "message-id",
    });
    expect(rpc).toHaveBeenCalledWith("send_chat_message_for", {
      _user_id: "u1",
      message_body: "Boa partida!",
    });
  });
});
