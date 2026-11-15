import { describe, expect, it } from "vitest";
import {
  CooperativeRosterV2Schema,
  cooperativeSeatForUser,
  cooperativeTeamForSeat,
  canExecuteCooperativeSeatCommand,
  signCooperativeSeatTicketV2,
  verifyCooperativeSeatTicketV2,
  issueCooperativeSeatTicketV2,
} from "./cooperative-seat-ticket-v2.server";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const users = {
  home_captain: "11afad22-c972-40cb-ab23-1b5ff625cb0f",
  home_partner: "2ac1a009-ff03-4cc4-a21f-4df45ce4b9c2",
  away_captain: "9d3a7db3-fbec-4508-9a9c-d5a9d609fd9b",
  away_partner: "74e189c2-67c0-4ad6-9d0b-2f32efc935a1",
} as const;
const now = 1_700_000_000_000;
const signingKey = "test-only-separate-v2-secret-at-least-thirty-two-characters";
const roster = {
  version: 2,
  roomId,
  status: "live",
  settlementAuthority: "websocket",
  serverSeeded: true,
  seats: users,
} as const;

describe("four independent authenticated seats, protocol v2 (no production activation)", () => {
  it("requires exactly four distinct UUID owners, strict fields and live server authority", () => {
    expect(CooperativeRosterV2Schema.parse(roster).seats).toEqual(users);
    expect(() =>
      CooperativeRosterV2Schema.parse({
        ...roster,
        seats: { ...users, away_partner: users.home_partner },
      }),
    ).toThrow();
    expect(() => CooperativeRosterV2Schema.parse({ ...roster, seed: "leak" })).toThrow();
    expect(() => CooperativeRosterV2Schema.parse({ ...roster, status: "waiting" })).toThrow();
    expect(() =>
      CooperativeRosterV2Schema.parse({ ...roster, settlementAuthority: "legacy" }),
    ).toThrow();
  });

  it("keeps physical participants distinct while mapping their teams to the legacy engine", () => {
    expect(cooperativeSeatForUser(roster, users.home_captain)).toBe("home_captain");
    expect(cooperativeSeatForUser(roster, users.home_partner)).toBe("home_partner");
    expect(cooperativeSeatForUser(roster, users.away_partner)).toBe("away_partner");
    expect(cooperativeSeatForUser(roster, "4bbd74d4-7359-48fb-ae7c-d31a9904d015")).toBeNull();
    expect(cooperativeTeamForSeat("home_partner")).toBe("home");
    expect(cooperativeTeamForSeat("away_captain")).toBe("away");
  });

  it("does not let a partner overwrite the captain's tactical orders", () => {
    expect(canExecuteCooperativeSeatCommand("home_partner", "ready")).toBe(true);
    expect(canExecuteCooperativeSeatCommand("away_partner", "ack_snapshot")).toBe(true);
    expect(canExecuteCooperativeSeatCommand("home_partner", "set_tactics")).toBe(false);
    expect(canExecuteCooperativeSeatCommand("away_partner", "substitute")).toBe(false);
    expect(canExecuteCooperativeSeatCommand("home_captain", "set_tactics")).toBe(true);
    expect(canExecuteCooperativeSeatCommand("away_captain", "substitute")).toBe(true);
    expect(canExecuteCooperativeSeatCommand("home_captain", "forfeit")).toBe(false);
  });

  it("HMAC binds room, user, team role, nonce, issue time and expiry without v1 fallback", async () => {
    const signed = await signCooperativeSeatTicketV2(
      {
        version: 2, roomId, seat: "home_partner", userId: users.home_partner,
        issuedAt: now, expiresAt: now + 90_000, nonce: "test-cooperative-nonce-123456789",
      },
      signingKey,
    );
    expect(await verifyCooperativeSeatTicketV2(signed, roster, signingKey, now + 100)).toBe(true);
    expect(await verifyCooperativeSeatTicketV2({ ...signed, seat: "home_captain" }, roster, signingKey, now + 100)).toBe(false);
    expect(await verifyCooperativeSeatTicketV2({ ...signed, userId: users.home_captain }, roster, signingKey, now + 100)).toBe(false);
    expect(await verifyCooperativeSeatTicketV2({ ...signed, roomId: "7e6d2b26-a479-4622-bf75-1f4713b2ae01" }, roster, signingKey, now + 100)).toBe(false);
    expect(await verifyCooperativeSeatTicketV2({ ...signed, nonce: "modified-cooperative-nonce-123456789" }, roster, signingKey, now + 100)).toBe(false);
    expect(await verifyCooperativeSeatTicketV2({ ...signed, version: 1 }, roster, signingKey, now + 100)).toBe(false);
    expect(await verifyCooperativeSeatTicketV2({ ...signed, seed: "leaked" }, roster, signingKey, now + 100)).toBe(false);
    expect(await verifyCooperativeSeatTicketV2(signed, roster, "wrong-independent-secret-at-least-thirty-two-characters", now + 100)).toBe(false);
    expect(await verifyCooperativeSeatTicketV2(signed, roster, signingKey, now + 90_000)).toBe(false);
    expect(await verifyCooperativeSeatTicketV2(signed, roster, signingKey, now - 1)).toBe(false);
  });

  it("rejects forged and overlong lifetimes, weak HMAC keys and malformed signatures", async () => {
    await expect(
      signCooperativeSeatTicketV2(
        {
          version: 2, roomId, seat: "home_partner", userId: users.home_partner,
          issuedAt: now, expiresAt: now + 90_001, nonce: "test-cooperative-nonce-123456789",
        }, signingKey,
      ),
    ).rejects.toThrow();
    await expect(
      signCooperativeSeatTicketV2(
        {
          version: 2, roomId, seat: "home_partner", userId: users.home_partner,
          issuedAt: now, expiresAt: now + 1_000, nonce: "test-cooperative-nonce-123456789",
        }, "weak",
      ),
    ).rejects.toThrow();
    expect(await verifyCooperativeSeatTicketV2({ signature: "fake" }, roster, signingKey, now)).toBe(false);
  });

  it("issues only to members using a trusted server lookup, never an asserted browser roster", async () => {
    const loadTrustedRoster = async (id: string) => (id === roomId ? roster : null);
    const args = { loadTrustedRoster, signingSecret: signingKey, now: () => now };
    const accepted = await issueCooperativeSeatTicketV2(args, users.away_partner, roomId);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.ticket.seat).toBe("away_partner");
      expect(accepted.ticket.userId).toBe(users.away_partner);
      expect(await verifyCooperativeSeatTicketV2(accepted.ticket, roster, signingKey, now)).toBe(true);
    }
    expect(await issueCooperativeSeatTicketV2(args, "4bbd74d4-7359-48fb-ae7c-d31a9904d015", roomId)).toEqual({ ok: false, reason: "unauthorized" });
    expect(await issueCooperativeSeatTicketV2({ ...args, loadTrustedRoster: async () => ({ ...roster, status: "waiting" }) }, users.home_captain, roomId)).toEqual({ ok: false, reason: "unavailable" });
    expect(await issueCooperativeSeatTicketV2({ ...args, loadTrustedRoster: async () => { throw Error("db down"); } }, users.home_captain, roomId)).toEqual({ ok: false, reason: "unavailable" });
  });
});
