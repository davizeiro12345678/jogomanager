import { describe, expect, it } from "vitest";
import { mergeRoomChatMessages, parseRoomChatMessage, parseRoomChatRow } from "./room-chat-safety";

describe("room chat incoming messages", () => {
  it("accepts a bounded message while removing display-control characters", () => {
    expect(parseRoomChatMessage({ id: "a", from: "a", text: "Boa\u202e partida!" })).toEqual({
      id: "a",
      from: "a",
      text: "Boa partida!",
    });
  });

  it.each([
    { id: "a", from: "a", text: "vou te matar" },
    { id: "a", from: "a", text: "p.o.r.r.a" },
    { id: "a", from: "a", text: "x".repeat(201) },
    { id: "a", from: "a", text: "  " },
    { id: "a", from: "a", text: { unexpected: true } },
    { id: "a", from: "x".repeat(1000), text: "Olá" },
    null,
  ])("drops invalid or abusive payloads", (payload) => {
    expect(parseRoomChatMessage(payload)).toBeNull();
  });

  it("deduplicates and orders messages when a realtime insert races the initial load", () => {
    const first = parseRoomChatRow({
      id: "a",
      sender_id: "one",
      body: "Olá",
      created_at: "2026-10-28T12:00:00Z",
    })!;
    const second = parseRoomChatRow({
      id: "b",
      sender_id: "two",
      body: "Oi",
      created_at: "2026-10-28T12:00:01Z",
    })!;
    expect(mergeRoomChatMessages([second], [first, second]).map((message) => message.id)).toEqual([
      "a",
      "b",
    ]);
    expect(
      parseRoomChatRow({ id: "x", sender_id: "one", body: "Olá", created_at: "bad" }),
    ).toBeNull();
  });
});
