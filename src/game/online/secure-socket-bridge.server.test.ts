import { describe, expect, it } from "vitest";
import { AuthoritativeMatchSession } from "./authoritative-match-session";
import { createSecureMatchSocketBridge } from "./secure-socket-bridge.server";
import { signMatchTicketV1 } from "./ticket-signing";
import type { MatchSeat } from "./match-protocol";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const now = 1_700_000_000_000;
const secret = "test-only-secure-bridge-hmac-secret-material-2026";
const identities = {
  home: "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9",
  away: "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef",
};
const ticket = (seat: MatchSeat) =>
  signMatchTicketV1(
    {
      version: 1,
      roomId,
      userId: identities[seat],
      seat,
      issuedAt: now,
      expiresAt: now + 60_000,
      nonce: `secure-bridge-${seat}-nonce-2026`,
    },
    secret,
  );

class TestSocket {
  readyState = 1;
  bufferedAmount = 0;
  sent: string[] = [];
  code: number | null = null;

  send(value: string) {
    this.sent.push(value);
  }

  close(code: number) {
    this.code = code;
    this.readyState = 3;
  }
}

async function setup() {
  const homeTicket = await ticket("home");
  const awayTicket = await ticket("away");
  const session = new AuthoritativeMatchSession({
    roomId,
    homeTicket,
    awayTicket,
    simulationVersion: "contact-2",
    idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
    signer: { sign: async () => "test-only-server-receipt-signature" },
    engine: {
      advanceFixedStep: () => true,
      publicState: () => ({
        minute: 0,
        score: { home: 0, away: 0 },
        possession: { home: 50, away: 50 },
      }),
      presentationEvents: () => [],
      applyTactics: () => false,
      substitute: () => false,
      finalResult: () => ({ homeGoals: 0, awayGoals: 0, winner: "draw" }),
    },
  });
  return { homeTicket, awayTicket, session };
}

describe("signed WebSocket bridge composition", () => {
  it("accepts a live signed seat ticket and rejects a changed seat", async () => {
    const { homeTicket, session } = await setup();
    const bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: secret,
      now: () => now,
    });
    const valid = new TestSocket();
    expect(await bridge.attach(valid, homeTicket)).toBe("home");
    expect(valid.sent).toHaveLength(1);
    const forged = new TestSocket();
    expect(await bridge.attach(forged, { ...homeTicket, seat: "away" })).toBeNull();
    expect(forged.code).toBe(1008);
    bridge.close();
  });

  it("accepts an independently issued new ticket without resetting the live seat", async () => {
    const { homeTicket, session } = await setup();
    const nextTime = now + 1_000;
    const renewed = await signMatchTicketV1(
      {
        version: 1,
        roomId,
        userId: identities.home,
        seat: "home",
        issuedAt: nextTime,
        expiresAt: nextTime + 60_000,
        nonce: "rotated-secure-bridge-nonce-2026",
      },
      secret,
    );
    const bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: secret,
      now: () => nextTime,
    });
    const previousSocket = new TestSocket();
    expect(await bridge.attach(previousSocket, homeTicket)).toBe("home");
    const freshSocket = new TestSocket();
    expect(await bridge.attach(freshSocket, renewed)).toBe("home");
    expect(previousSocket.code).toBe(4001);
    const stale = new TestSocket();
    expect(await bridge.attach(stale, homeTicket)).toBeNull();
    expect(stale.code).toBe(1008);
    expect(freshSocket.readyState).toBe(1);
    bridge.close();
  });

  it("does not mutate an existing seat when an attacker changes a signed claim", async () => {
    const { homeTicket, session } = await setup();
    const bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: secret,
      now: () => now + 1_000,
    });
    const forged = new TestSocket();
    expect(
      await bridge.attach(forged, {
        ...homeTicket,
        issuedAt: now + 1_000,
        expiresAt: now + 61_000,
        nonce: "forged-bridge-claim-nonce-2026",
      }),
    ).toBeNull();
    expect(forged.code).toBe(1008);
    const valid = new TestSocket();
    expect(await bridge.attach(valid, homeTicket)).toBe("home");
    bridge.close();
  });

  it("rejects expired tickets before connection admission", async () => {
    const { homeTicket, session } = await setup();
    const bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: secret,
      now: () => now + 60_000,
    });
    const socket = new TestSocket();
    expect(await bridge.attach(socket, homeTicket)).toBeNull();
    expect(socket.code).toBe(1008);
    expect(session.phase).toBe("waiting");
  });

  it("fails fast when the signing secret is unsafe", async () => {
    const { session } = await setup();
    expect(() => createSecureMatchSocketBridge({ session, signingSecret: "" })).toThrow();
    expect(() => createSecureMatchSocketBridge({ session, signingSecret: "weak" })).toThrow();
  });
});
