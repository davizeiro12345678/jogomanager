import { describe, expect, it, vi } from "vitest";
import { createPrivateMatchRoom } from "./multiplayer-room-create.server";

type Db = Parameters<typeof createPrivateMatchRoom>[0];
const hostId = "83c2f28e-d72e-43c0-9c52-70688f5f6a3e";
const room = {
  id: "8534946c-d202-4b0b-a2ce-f39b35c181e3",
  host_id: hostId,
  host_club: "br_fla",
  seed: "",
  status: "open",
  server_seeded: true,
};

describe("atomic private room creation", () => {
  it("sends only server-generated code and seed with the authenticated host identity", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ result: "created", room }], error: null });
    expect(await createPrivateMatchRoom({ rpc } as unknown as Db, hostId, "br_fla")).toEqual({
      ok: true,
      room,
    });
    expect(rpc).toHaveBeenCalledWith("create_match_room_for", {
      p_host_id: hostId,
      p_host_club: "br_fla",
      p_code: expect.stringMatching(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/),
      p_seed: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
  });
  it("retries a code collision at most three times with a new private seed", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "23505", message: "collision" } });
    expect(await createPrivateMatchRoom({ rpc } as unknown as Db, hostId, "br_fla")).toEqual({
      ok: false,
      reason: "create_failed",
    });
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(new Set(rpc.mock.calls.map((call) => call[1].p_seed)).size).toBe(3);
  });
  it.each([
    ["room_hourly_limit", "rate_limited"],
    ["room_active_limit", "too_many_rooms"],
  ])("maps %s without retrying or exposing a private seed", async (result, reason) => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ result, room: null }], error: null });
    expect(await createPrivateMatchRoom({ rpc } as unknown as Db, hostId, "br_fla")).toEqual({
      ok: false,
      reason,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("fails closed on an unavailable atomic RPC without falling back to separate writes", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "PGRST202", message: "function missing" } });
    expect(await createPrivateMatchRoom({ rpc } as unknown as Db, hostId, "br_fla")).toEqual({
      ok: false,
      reason: "create_failed",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
