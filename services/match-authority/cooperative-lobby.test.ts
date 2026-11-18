import { describe, expect, it, vi } from "vitest";
import {
  CooperativeSeatV2Schema,
  signCooperativeSeatTicketV2,
  type CooperativeSeatV2,
} from "../../src/game/online/cooperative-seat-ticket-v2.server";
import { CooperativeLobby } from "./cooperative-lobby";

const roomId = "12345678-1234-4123-8123-123456789012";
const now = 1_700_000_000_000;
const secret = "isolated-cooperative-lobby-fixture-secret";
const seats = {
  home_captain: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  home_partner: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  away_captain: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  away_partner: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
};
const roster = {
  version: 2,
  roomId,
  status: "live",
  settlementAuthority: "websocket",
  serverSeeded: true,
  seats,
};

async function ticket(seat: CooperativeSeatV2, issuedAt = now - 1) {
  return signCooperativeSeatTicketV2(
    {
      version: 2,
      roomId,
      userId: seats[seat],
      seat,
      issuedAt,
      expiresAt: now + 1_000,
      nonce: "synthetic-seat-ticket-nonce",
    },
    secret,
  );
}

class Socket {
  readyState = 1;
  bufferedAmount = 0;
  frames: unknown[] = [];
  send(raw: string) {
    this.frames.push(JSON.parse(raw));
  }
  close() {
    this.readyState = 3;
  }
}

describe("staging cooperative presence", () => {
  it("admits all four independently and persists the admission before announcing it", async () => {
    const accepted = new Map<CooperativeSeatV2, number>();
    const lobby = new CooperativeLobby({
      roomId,
      secret,
      loadRoster: async () => roster,
      now: () => now,
      claim: async (seat, issuedAt) => {
        if (issuedAt <= (accepted.get(seat) ?? -1)) return false;
        accepted.set(seat, issuedAt);
        return true;
      },
    });
    const joins = CooperativeSeatV2Schema.options.map(() => new Socket());
    for (const [index, seat] of CooperativeSeatV2Schema.options.entries()) {
      const socket = joins[index]!;
      expect(
        await lobby.attach(
          socket,
          JSON.stringify({ type: "authenticate", version: 2, ticket: await ticket(seat) }),
        ),
      ).toBe(now + 1_000);
      expect(accepted.has(seat)).toBe(true);
      expect(socket.frames[0]).toMatchObject({ type: "admitted", seat });
    }
    expect(joins[0]!.frames.at(-1)).toMatchObject({
      type: "presence",
      seats: CooperativeSeatV2Schema.options,
    });
    const oldFrame = JSON.stringify({
      type: "authenticate",
      version: 2,
      ticket: await ticket("home_partner"),
    });
    expect(await lobby.attach(new Socket(), oldFrame)).toBeNull();
    const replacement = new Socket();
    expect(
      await lobby.attach(
        replacement,
        JSON.stringify({
          type: "authenticate",
          version: 2,
          ticket: await ticket("home_partner", now),
        }),
      ),
    ).toBe(now + 1_000);
    expect(joins[1]!.readyState).toBe(3);
    lobby.detach(joins[1]!);
    expect(replacement.frames.at(-1)).toMatchObject({
      type: "presence",
      seats: CooperativeSeatV2Schema.options,
    });
  });

  it("revokes established presence when the authoritative roster closes", async () => {
    const socket = new Socket();
    let live = true;
    const claim = vi.fn(async () => true);
    const lobby = new CooperativeLobby({
      roomId,
      secret,
      loadRoster: async () => (live ? roster : null),
      now: () => now,
      claim,
    });
    const frame = async (seat: CooperativeSeatV2) =>
      JSON.stringify({ type: "authenticate", version: 2, ticket: await ticket(seat) });
    expect(await lobby.attach(socket, await frame("home_captain"))).toBe(now + 1_000);
    live = false;
    const rejected = new Socket();
    expect(await lobby.attach(rejected, await frame("away_partner"))).toBeNull();
    expect(socket.readyState).toBe(3);
    expect(rejected.frames).toEqual([]);
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid signatures before calling the database", async () => {
    const loadRoster = vi.fn(async () => roster);
    const claim = vi.fn(async () => true);
    const lobby = new CooperativeLobby({ roomId, secret, loadRoster, claim, now: () => now });
    const signed = await ticket("home_captain");
    const signature = (signed.signature[0] === "a" ? "b" : "a") + signed.signature.slice(1);
    expect(
      await lobby.attach(
        new Socket(),
        JSON.stringify({ type: "authenticate", version: 2, ticket: { ...signed, signature } }),
      ),
    ).toBeNull();
    expect(loadRoster).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
  });
});
