import { describe, expect, it } from "vitest";
import { appendRoomChatMessage } from "./room-chat-messages";

describe("actor-scoped room message identity", () => {
  it("dedupes a retried sender message without hiding another member using the same UUID", () => {
    const host = { id: "same-uuid", senderId: "host", text: "Boa partida" };
    const guest = { id: "same-uuid", senderId: "guest", text: "Obrigado" };
    const current = [host];
    expect(appendRoomChatMessage(current, { ...host })).toBe(current);
    expect(appendRoomChatMessage(current, guest)).toEqual([host, guest]);
  });
  it("keeps only the latest forty distinct sender messages", () => {
    const messages = Array.from({ length: 40 }, (_, index) => ({
      id: String(index),
      senderId: "host",
    }));
    const last = { id: "new", senderId: "guest" };
    const result = appendRoomChatMessage(messages, last);
    expect(result).toHaveLength(40);
    expect(result[0]).toEqual(messages[1]);
    expect(result.at(-1)).toBe(last);
    expect(messages).toHaveLength(40);
  });
});
