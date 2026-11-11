import { describe, expect, it } from "vitest";
import { issueMatchSeatTicket, type TicketRoom } from "./seat-ticket-issuer.server";
import { verifyMatchTicketV1 } from "./ticket-signing";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const homeId = "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9";
const awayId = "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef";
const strangerId = "3d6ff05d-83b2-4c46-9c41-de14a0c3fd44";
const secret = "ticket-issuer-unit-test-using-strong-secret-material-only";
const now = 1_700_000_000_000;
const room: TicketRoom = {
  id: roomId,
  host_id: homeId,
  guest_id: awayId,
  status: "live",
  server_seeded: true,
};
function issuer(userId: string, roomOverride: TicketRoom | null = room, signingSecret = secret) {
  return issueMatchSeatTicket(
    { loadRoom: async () => roomOverride, signingSecret, now: () => now },
    userId,
    roomId,
  );
}

describe("server-only multiplayer seat tickets", () => {
  it("binds signed tickets to the correct participant, room and expiry", async () => {
    const home = await issuer(homeId);
    const away = await issuer(awayId);
    expect(home.ok).toBe(true);
    expect(away.ok).toBe(true);
    if (!home.ok || !away.ok) throw new Error("ticket issuance failed");

    expect(home.ticket.seat).toBe("home");
    expect(away.ticket.seat).toBe("away");
    expect(home.ticket.userId).toBe(homeId);
    expect(home.ticket.roomId).toBe(roomId);
    expect(home.ticket.expiresAt - home.ticket.issuedAt).toBe(90_000);
    expect(home.ticket.nonce).not.toBe(away.ticket.nonce);
    expect(await verifyMatchTicketV1(home.ticket, secret)).toBe(true);
    expect(await verifyMatchTicketV1(away.ticket, secret)).toBe(true);
    expect(await verifyMatchTicketV1({ ...home.ticket, seat: "away" }, secret)).toBe(false);
    expect(await verifyMatchTicketV1({ ...home.ticket, userId: strangerId }, secret)).toBe(false);
  });

  it("does not issue tickets for strangers or mismatched room IDs", async () => {
    expect(await issuer(strangerId)).toEqual({ ok: false, reason: "unauthorized" });
    expect(await issuer(homeId, { ...room, id: strangerId })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("rejects unfinished, foreign, unseeded and single-seat rooms", async () => {
    expect(await issuer(homeId, { ...room, status: "ready" })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await issuer(homeId, { ...room, server_seeded: false })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await issuer(homeId, { ...room, guest_id: null })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await issuer(homeId, null)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("fails closed on missing/weak HMAC key or lookup error", async () => {
    expect(await issuer(homeId, room, "")).toEqual({ ok: false, reason: "unavailable" });
    expect(await issuer(homeId, room, "weak")).toEqual({
      ok: false,
      reason: "unavailable",
    });
    const failed = await issueMatchSeatTicket(
      { signingSecret: secret, loadRoom: async () => Promise.reject(new Error("db offline")) },
      homeId,
      roomId,
    );
    expect(failed).toEqual({ ok: false, reason: "unavailable" });
  });
});
