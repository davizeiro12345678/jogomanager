import { describe, expect, it } from "vitest";
import { parseRoomChatMessage } from "./room-chat-safety";

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
  ])("drops invalid or abusive broadcast payloads", (payload) => {
    expect(parseRoomChatMessage(payload)).toBeNull();
  });
});
