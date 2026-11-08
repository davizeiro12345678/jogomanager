import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "00000000-0000-4000-8000-000000000001",
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mocks }));
vi.mock("./push.server", () => ({
  MAX_TOKENS_PER_EVENT: 200,
  notifyUsers: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input: unknown): unknown => input;
    const builder = {
      middleware: () => builder,
      validator: (next: (input: unknown) => unknown) => {
        validate = next;
        return builder;
      },
      handler:
        (handle: (args: { data: unknown; context: { userId: string } }) => unknown) =>
        async (args: { data: unknown }) =>
          handle({ data: validate(args.data), context: { userId: mocks.userId } }),
    };
    return builder;
  },
}));

import { sendChatMessage } from "./chat.functions";

const send = sendChatMessage as unknown as (args: { data: unknown }) => Promise<unknown>;

function configureDatabase() {
  const query = {
    select: () => query,
    eq: () => query,
    gte: async () => ({ data: [], error: null }),
    order: () => query,
    limit: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: { display_name: "Técnico" }, error: null }),
    neq: () => query,
  };
  mocks.from.mockImplementation(() => query);
  mocks.rpc.mockResolvedValue({ data: "00000000-0000-4000-8000-000000000010", error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  configureDatabase();
});

describe("chat message authority boundary", () => {
  it("uses the authenticated session identity and normalized body for the server RPC", async () => {
    await expect(send({ data: { body: "  Olá\u0000 técnico  " } })).resolves.toEqual({
      ok: true,
      id: "00000000-0000-4000-8000-000000000010",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("send_chat_message_for", {
      _user_id: mocks.userId,
      message_body: "Olá técnico",
    });
  });

  it.each([
    { sender_id: "00000000-0000-4000-8000-000000000099" },
    { moderation_state: "approved" },
    { hidden: false },
    { from: "client-controlled" },
  ])("rejects client authority field %j before any write", async (field) => {
    await expect(send({ data: { body: "Mensagem válida", ...field } })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a client_message_id until the durable server contract exists", async () => {
    await expect(
      send({ data: { body: "Mensagem válida", client_message_id: "msg-0001" } }),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("enforces the existing 500-character bound before contacting the database", async () => {
    await expect(send({ data: { body: "a".repeat(501) } })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
