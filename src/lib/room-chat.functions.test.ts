import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "00000000-0000-4000-8000-000000000001",
  rpc: vi.fn(),
  from: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mocks }));
vi.mock("./push.server", () => ({ MAX_TOKENS_PER_EVENT: 200, notifyUsers: vi.fn() }));
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
import { sendRoomChatMessage } from "./chat.functions";

const send = sendRoomChatMessage as unknown as (args: { data: unknown }) => Promise<unknown>;
const roomId = "10000000-0000-4000-8000-000000000001";
const clientMessageId = "00000000-0000-4000-8000-000000000010";
const leaseToken = "00000000-0000-4000-8000-000000000011";
const createdAt = "2026-11-08T22:00:00.000Z";
const input = { roomId, text: "Boa partida!", clientMessageId };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-fixture");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(new Response(null, { status: 202 }));
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.rpc.mockResolvedValueOnce({
    data: { status: "leased", leaseToken, createdAt },
    error: null,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("room chat atomic admission boundary", () => {
  it("derives sender on the server and broadcasts only an admitted bounded private message", async () => {
    await expect(send({ data: input })).resolves.toEqual({
      ok: true,
      id: clientMessageId,
      text: input.text,
      senderId: mocks.userId,
      createdAt,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "admit_room_chat_message",
      expect.objectContaining({
        p_user_id: mocks.userId,
        p_room_id: roomId,
        p_message_id: clientMessageId,
        p_payload_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_repeat_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_moderation_reason: null,
      }),
    );
    expect(mocks.from).not.toHaveBeenCalled();
    const [url, request] = mocks.fetch.mock.calls[0]!;
    expect(url).toBe("https://project.supabase.invalid/realtime/v1/api/broadcast");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request.body).messages).toEqual([
      {
        topic: `room-chat-${roomId}`,
        event: "msg",
        private: true,
        payload: { id: clientMessageId, text: input.text, senderId: mocks.userId, createdAt },
      },
    ]);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "finish_room_chat_message", {
      p_user_id: mocks.userId,
      p_message_id: clientMessageId,
      p_lease_token: leaseToken,
      p_delivered: true,
    });
  });
  it("returns an already-delivered receipt without rebroadcasting or consuming a new rate slot", async () => {
    mocks.rpc.mockReset().mockResolvedValue({ data: { status: "sent", createdAt }, error: null });
    await expect(send({ data: input })).resolves.toMatchObject({
      ok: true,
      id: clientMessageId,
      createdAt,
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(["rate_limited", "pending", "room_unavailable", "conflict", "expired", "unavailable"])(
    "never broadcasts a %s admission",
    async (status) => {
      mocks.rpc.mockReset().mockResolvedValue({ data: { status }, error: null });
      await expect(send({ data: input })).resolves.toMatchObject({ ok: false });
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );
  it("uses the durable room repetition decision rather than global chat history", async () => {
    mocks.rpc
      .mockReset()
      .mockResolvedValue({ data: { status: "blocked", rule: "repeated" }, error: null });
    await expect(send({ data: input })).resolves.toEqual({
      ok: false,
      reason: "blocked",
      message: expect.stringContaining("repetir"),
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("passes static moderation to the same atomic admission and applies persistent mutes", async () => {
    mocks.rpc
      .mockReset()
      .mockResolvedValue({ data: { status: "muted", until: "2099-01-01T00:00:00Z" }, error: null });
    await expect(send({ data: { ...input, text: "www.example.com" } })).resolves.toMatchObject({
      ok: false,
      reason: "muted",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "admit_room_chat_message",
      expect.objectContaining({ p_moderation_reason: "link" }),
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { senderId: "spoof" },
    { roomId: "bad" },
    { clientMessageId: "bad" },
    { text: "x".repeat(201) },
  ])("rejects invalid or client authority input %j before database access", async (extra) => {
    await expect(send({ data: { ...input, ...extra } })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("keeps the same receipt after an ambiguous network failure and never marks it delivered", async () => {
    mocks.fetch.mockRejectedValue(new Error("fixture timeout"));
    await expect(send({ data: input })).resolves.toEqual({ ok: false, reason: "error" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      "finish_room_chat_message",
      expect.objectContaining({ p_message_id: clientMessageId, p_delivered: false }),
    );
  });
  it("does not report success if final durable acknowledgement fails", async () => {
    mocks.rpc
      .mockReset()
      .mockResolvedValueOnce({ data: { status: "leased", leaseToken, createdAt }, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    await expect(send({ data: input })).resolves.toEqual({ ok: false, reason: "error" });
  });
  it("rejects malformed database receipts and missing server configuration without delivery", async () => {
    mocks.rpc.mockReset().mockResolvedValue({
      data: { status: "leased", leaseToken: "not-a-lease", createdAt },
      error: null,
    });
    await expect(send({ data: input })).resolves.toMatchObject({ ok: false });
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(send({ data: input })).resolves.toMatchObject({ ok: false });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
