import { describe, expect, it } from "vitest";
import { readMultiplayerRoomQuery } from "./multiplayer-room-query";

describe("multiplayer room query result", () => {
  it("preserves a successful empty room list", () => {
    expect(readMultiplayerRoomQuery({ data: [], error: null })).toEqual([]);
  });
  it("preserves a successful missing room", () => {
    expect(readMultiplayerRoomQuery({ data: null, error: null })).toBeNull();
  });
  it("does not treat a denied room query as an empty list", () => {
    const error = { code: "42501", message: "permission denied" };
    expect(() => readMultiplayerRoomQuery({ data: null, error })).toThrow();
  });
  it("rejects even partial data when the query reports an error", () => {
    expect(() =>
      readMultiplayerRoomQuery({ data: [{ id: "room" }], error: { message: "unavailable" } }),
    ).toThrow();
  });
});
