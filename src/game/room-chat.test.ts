import { describe, expect, it } from "vitest";
import { readRoomMessage, mergeRoomMessages } from "./room-chat";
const room = "00000000-0000-4000-8000-000000000001";
const message = {
  id: "00000000-0000-4000-8000-000000000002",
  room_id: room,
  user_id: "00000000-0000-4000-8000-000000000003",
  body: "Olá!",
  created_at: "2026-10-24T00:00:00Z",
};
describe("database room-chat boundary", () => {
  it("accepts only valid rows from the current room and drops browser identity fields", () => {
    expect(readRoomMessage({ ...message, from: "forged", text: { crash: true } }, room)).toEqual(
      message,
    );
    expect(readRoomMessage(message, "another-room")).toBeNull();
  });
  it.each([
    null,
    [],
    {},
    { ...message, body: {} },
    { ...message, body: "a".repeat(201) },
    { ...message, body: "   " },
    { ...message, user_id: "spoof" },
    { ...message, created_at: "invalid" },
  ])("rejects malformed input %j", (input) => {
    expect(readRoomMessage(input, room)).toBeNull();
  });
  it("deduplicates replayed events and bounds reconnect history", () => {
    const rows = Array.from({ length: 55 }, (_, i) => ({
      ...message,
      id: String(i).padStart(3, "0"),
      created_at: new Date(i * 1000).toISOString(),
    }));
    const merged = mergeRoomMessages(rows, [rows[54]!, rows[20]!]);
    expect(merged).toHaveLength(40);
    expect(merged[0]?.id).toBe("015");
    expect(merged.at(-1)?.id).toBe("054");
  });
});
