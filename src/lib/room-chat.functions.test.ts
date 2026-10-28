import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const review = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      validator: (validate: (value: unknown) => unknown) => ({
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
vi.mock("@/lib/context-moderation.server", () => ({ reviewChatBeforePublish: review }));

import { sendRoomChatMessage } from "./room-chat.functions";

const roomId = "123e4567-e89b-42d3-a456-426614174000";
const send = sendRoomChatMessage as unknown as (args: {
  data: Record<string, unknown>;
  context: { userId: string };
}) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  review.mockResolvedValue("allow");
});

describe("room chat server boundary", () => {
  it("uses the verified identity for a valid message", async () => {
    rpc.mockResolvedValue({ data: "message-id", error: null });
    await expect(
      send({ data: { roomId, body: "Boa partida!" }, context: { userId: "host" } }),
    ).resolves.toEqual({ ok: true, id: "message-id" });
    expect(rpc).toHaveBeenCalledWith("send_match_room_message_for", {
      _room_id: roomId,
      _user_id: "host",
      _body: "Boa partida!",
    });
    expect(review).toHaveBeenCalledWith("host", "Boa partida!", roomId);
  });

  it.each([
    ["block", "blocked"],
    ["rate_limited", "rate_limited"],
    ["unavailable", "error"],
  ])(
    "does not record a message when contextual moderation returns %s",
    async (decision, reason) => {
      review.mockResolvedValue(decision);
      await expect(
        send({ data: { roomId, body: "Uma mensagem" }, context: { userId: "host" } }),
      ).resolves.toEqual({ ok: false, reason });
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("blocks abusive content before it is recorded", async () => {
    await expect(
      send({ data: { roomId, body: "p.o.r.r.a" }, context: { userId: "host" } }),
    ).resolves.toEqual({ ok: false, reason: "blocked" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses forged sender fields", async () => {
    await expect(
      send({
        data: { roomId, body: "Olá", senderId: "other" },
        context: { userId: "host" },
      }),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["not_participant", "not_participant"],
    ["rate_limited", "rate_limited"],
  ])("propagates the safe %s rejection", async (message, reason) => {
    rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(
      send({ data: { roomId, body: "Olá" }, context: { userId: "host" } }),
    ).resolves.toEqual({ ok: false, reason });
  });
});
