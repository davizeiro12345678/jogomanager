import { describe, expect, it } from "vitest";
import { CooperativeCommandPolicy } from "./cooperative-command-policy.server";

const players = {
  home: {
    captainId: "11afad22-c972-40cb-ab23-1b5ff625cb0f",
    partnerId: "2ac1a009-ff03-4cc4-a21f-4df45ce4b9c2",
  },
  away: {
    captainId: "9d3a7db3-fbec-4508-9a9c-d5a9d609fd9b",
    partnerId: "74e189c2-67c0-4ad6-9d0b-2f32efc935a1",
  },
};
const now = 1_700_000_000_000;

describe("server-owned cooperative 2v2 authorization", () => {
  it("requires four unique, canonical participants", () => {
    expect(
      () =>
        new CooperativeCommandPolicy({
          ...players,
          away: { ...players.away, partnerId: players.home.partnerId },
        }),
    ).toThrow();
    expect(
      () =>
        new CooperativeCommandPolicy({
          ...players,
          home: { ...players.home, captainId: "forged" },
        }),
    ).toThrow();
  });

  it("enforces team boundaries and allows tactical commands only to the captain", () => {
    const policy = new CooperativeCommandPolicy(players);
    expect(policy.seatForUser(players.home.captainId)).toBe("home");
    expect(policy.seatForUser(players.away.partnerId)).toBe("away");
    expect(policy.canExecute(players.home.captainId, "home", "set_tactics")).toBe(true);
    expect(policy.canExecute(players.home.partnerId, "home", "set_tactics")).toBe(false);
    expect(policy.canExecute(players.home.partnerId, "home", "ready")).toBe(true);
    expect(policy.canExecute(players.away.captainId, "home", "substitute")).toBe(false);
    expect(policy.canExecute(players.home.captainId, "home", "forfeit")).toBe(false);
    expect(policy.canExecute("forged", "home", "ready")).toBe(false);
  });

  it("requires agreement of both partners for a single forfeit", () => {
    const policy = new CooperativeCommandPolicy(players);
    expect(policy.voteToForfeit(players.home.partnerId, "home", now)).toEqual({
      status: "pending",
      votes: 1,
    });
    expect(policy.voteToForfeit(players.away.partnerId, "home", now + 1)).toEqual({
      status: "rejected",
      reason: "unauthorized",
    });
    expect(policy.voteToForfeit(players.home.captainId, "home", now + 20_000)).toEqual({
      status: "approved",
      votes: 2,
    });
    expect(policy.isForfeitApproved("home")).toBe(true);
    expect(policy.isForfeitApproved("away")).toBe(false);
    expect(policy.voteToForfeit(players.home.captainId, "home", now + 21_000)).toEqual({
      status: "rejected",
      reason: "already_approved",
    });
  });

  it("expires abandoned votes and never accepts a reversed clock", () => {
    const policy = new CooperativeCommandPolicy(players);
    policy.voteToForfeit(players.away.captainId, "away", now);
    expect(policy.voteToForfeit(players.away.partnerId, "away", now + 30_000)).toEqual({
      status: "pending",
      votes: 1,
    });
    expect(policy.voteToForfeit(players.away.captainId, "away", now + 30_001)).toEqual({
      status: "approved",
      votes: 2,
    });
    expect(policy.voteToForfeit(players.home.captainId, "home", Number.NaN)).toEqual({
      status: "rejected",
      reason: "expired",
    });
  });

  it("captain transfer invalidates prior votes and keeps the team boundary", () => {
    const policy = new CooperativeCommandPolicy(players);
    policy.voteToForfeit(players.home.captainId, "home", now);
    expect(policy.transferCaptain("home", players.away.captainId, players.home.partnerId)).toBe(
      false,
    );
    expect(policy.transferCaptain("home", players.home.captainId, players.home.partnerId)).toBe(
      true,
    );
    expect(policy.canExecute(players.home.partnerId, "home", "set_tactics")).toBe(true);
    expect(policy.canExecute(players.home.captainId, "home", "set_tactics")).toBe(false);
    expect(policy.voteToForfeit(players.home.partnerId, "home", now + 10)).toEqual({
      status: "pending",
      votes: 1,
    });
  });
});
