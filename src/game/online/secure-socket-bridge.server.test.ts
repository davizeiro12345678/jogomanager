import { describe, expect, it, vi } from "vitest";
import { AuthoritativeSocketAdmission } from "./authoritative-socket-admission.server";
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

async function setup(finishAfterSteps = Number.MAX_SAFE_INTEGER) {
  let steps = 0;
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
      advanceFixedStep: () => {
        steps += 1;
        return true;
      },
      isFinished: () => steps >= finishAfterSteps,
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

  it("admits a WebSocket only after a signed first-frame authentication", async () => {
    const { homeTicket, session } = await setup();
    const bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: secret,
      now: () => now,
    });
    const socket = new TestSocket();
    const admission = new AuthoritativeSocketAdmission(bridge, socket);
    expect(socket.sent).toHaveLength(0);
    await admission.onMessage(
      JSON.stringify({ type: "authenticate", version: 1, ticket: homeTicket }),
    );
    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0]!).type).toBe("ready");
    await admission.onMessage(JSON.stringify({ type: "ping" }));
    expect(JSON.parse(socket.sent[1]!).type).toBe("pong");
    admission.detach();
    bridge.close();
  });

  it("rejects first-frame commands and tampered tickets before connecting a seat", async () => {
    const { homeTicket, session } = await setup();
    const bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: secret,
      now: () => now,
    });
    const commandSocket = new TestSocket();
    const commandAdmission = new AuthoritativeSocketAdmission(bridge, commandSocket);
    await commandAdmission.onMessage(JSON.stringify({ type: "ping" }));
    expect(commandSocket.code).toBe(1008);

    const forgery = new TestSocket();
    const forgedAdmission = new AuthoritativeSocketAdmission(bridge, forgery);
    await forgedAdmission.onMessage(
      JSON.stringify({
        type: "authenticate",
        version: 1,
        ticket: { ...homeTicket, userId: identities.away },
      }),
    );
    expect(forgery.code).toBe(1008);
    expect(session.phase).toBe("waiting");
    bridge.close();
  });

  it("closes sockets that never authenticate without advancing match time", async () => {
    vi.useFakeTimers();
    try {
      const { session } = await setup();
      const bridge = createSecureMatchSocketBridge({
        session,
        signingSecret: secret,
        now: () => now,
      });
      const socket = new TestSocket();
      const admission = new AuthoritativeSocketAdmission(bridge, socket);
      await vi.advanceTimersByTimeAsync(5_001);
      expect(socket.code).toBe(1008);
      expect(session.snapshot().tick).toBe(0);
      admission.detach();
      bridge.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it("signs and announces exactly one final result after a server-owned full time", async () => {
    const { homeTicket, awayTicket, session } = await setup(2);
    const bridge = createSecureMatchSocketBridge({
      session,
      signingSecret: secret,
      now: () => now,
    });
    const homeSocket = new TestSocket();
    const awaySocket = new TestSocket();
    expect(await bridge.attach(homeSocket, homeTicket)).toBe("home");
    expect(await bridge.attach(awaySocket, awayTicket)).toBe("away");
    const ready = JSON.stringify({
      type: "command",
      command: { version: 1, roomId, sequence: 1, kind: "ready", payload: { ready: true } },
    });
    await bridge.onMessage(homeSocket, ready);
    await bridge.onMessage(awaySocket, ready);
    expect(session.phase).toBe("live");
    await bridge.pulse();
    await bridge.pulse();
    await bridge.pulse();
    expect(session.phase).toBe("finalized");
    expect(session.snapshot().tick).toBe(2);
    const sent = homeSocket.sent.map((raw) => JSON.parse(raw) as { type: string });
    expect(sent.filter((event) => event.type === "final")).toHaveLength(1);
    expect(sent.filter((event) => event.type === "snapshot").at(-1)).toHaveProperty("snapshot.phase", "finalized");
    bridge.close();
  });

  it("fails fast when the signing secret is unsafe", async () => {
    const { session } = await setup();
    expect(() => createSecureMatchSocketBridge({ session, signingSecret: "" })).toThrow();
    expect(() => createSecureMatchSocketBridge({ session, signingSecret: "weak" })).toThrow();
  });
});
