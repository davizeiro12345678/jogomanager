import { describe, expect, it } from "vitest";

import { canJoinRoomChat, type RoomChatMembership } from "./room-chat-access";

const room: RoomChatMembership = {
  host_id: "host-uuid",
  guest_id: "guest-uuid",
  status: "live",
};

describe("canJoinRoomChat", () => {
  it("allows the host and the joined guest while the room is active", () => {
    expect(canJoinRoomChat({ ...room, status: "open" }, "host-uuid")).toBe(true);
    expect(canJoinRoomChat(room, "guest-uuid")).toBe(true);
    expect(canJoinRoomChat({ ...room, status: "settling" }, "host-uuid")).toBe(true);
  });

  it("does not treat an open lobby listing as chat membership", () => {
    expect(canJoinRoomChat({ ...room, guest_id: null, status: "open" }, "stranger-uuid")).toBe(
      false,
    );
  });

  it("rejects unauthenticated callers and completed rooms", () => {
    expect(canJoinRoomChat(room, null)).toBe(false);
    expect(canJoinRoomChat({ ...room, status: "done" }, "host-uuid")).toBe(false);
  });
});
